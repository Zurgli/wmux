import { chromium, type Browser, type Page } from 'playwright-core';
import { sendRpc } from '../wmux-client';

interface CdpTargetInfo {
  surfaceId: string;
  webContentsId: number;
  targetId: string;
  wsUrl: string;
}

interface CdpInfoResponse {
  cdpPort: number;
  targets: CdpTargetInfo[];
}

interface JsonTarget {
  id: string;
  url: string;
  type: string;
  title: string;
  webSocketDebuggerUrl?: string;
}

const MAX_CONNECT_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const PAGE_FIND_RETRIES = 5;
const PAGE_FIND_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the URL belongs to the Electron main renderer window.
 * Navigating these pages would destroy the app — they must never be returned.
 */
function isElectronShellUrl(url: string): boolean {
  return (
    url.startsWith('http://localhost:') ||
    url.startsWith('devtools://') ||
    url.startsWith('chrome://')
  );
}

/**
 * PlaywrightEngine -- singleton wrapper around playwright-core's Chromium CDP connection.
 *
 * Connects to the wmux Electron app via Chrome DevTools Protocol and provides
 * access to browser pages for automation.
 */
export class PlaywrightEngine {
  private static instance: PlaywrightEngine | null = null;

  private browser: Browser | null = null;
  private cdpPort: number | null = null;

  private constructor() {}

  static getInstance(): PlaywrightEngine {
    if (!PlaywrightEngine.instance) {
      PlaywrightEngine.instance = new PlaywrightEngine();
    }
    return PlaywrightEngine.instance;
  }

  async connect(cdpPort: number): Promise<void> {
    if (this.browser && this.cdpPort === cdpPort && this.browser.isConnected()) {
      return;
    }
    await this.disconnect();
    this.browser = await chromium.connectOverCDP(`http://localhost:${cdpPort}`);
    this.cdpPort = cdpPort;
    console.log(`[PlaywrightEngine] Connected to CDP on port ${cdpPort}`);
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      this.browser = null;
      this.cdpPort = null;
      console.log('[PlaywrightEngine] Disconnected');
    }
  }

  /**
   * Force reconnect — drops existing connection and creates a fresh one.
   * Needed when new webviews are created after the initial connection,
   * because connectOverCDP only discovers targets at connection time.
   */
  async reconnect(): Promise<void> {
    const info = (await sendRpc('browser.cdp.info')) as CdpInfoResponse;
    await this.disconnect();
    await this.connect(info.cdpPort);
  }

  async ensureConnected(): Promise<void> {
    if (this.browser?.isConnected()) return;

    for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
      try {
        const info = (await sendRpc('browser.cdp.info')) as CdpInfoResponse;
        await this.connect(info.cdpPort);
        return;
      } catch (err) {
        console.warn(
          `[PlaywrightEngine] Connection attempt ${attempt}/${MAX_CONNECT_RETRIES} failed:`,
          err instanceof Error ? err.message : String(err),
        );
        if (attempt < MAX_CONNECT_RETRIES) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    throw new Error(`[PlaywrightEngine] Failed to connect after ${MAX_CONNECT_RETRIES} attempts`);
  }

  /**
   * Collect all Playwright Page objects from all contexts.
   */
  private getAllPages(): Page[] {
    if (!this.browser || !this.browser.isConnected()) return [];
    const pages: Page[] = [];
    for (const ctx of this.browser.contexts()) {
      pages.push(...ctx.pages());
    }
    return pages;
  }

  /**
   * Fetch the CDP /json target list.
   */
  private async fetchJsonTargets(): Promise<JsonTarget[]> {
    if (!this.cdpPort) return [];
    const resp = await fetch(`http://127.0.0.1:${this.cdpPort}/json`);
    return (await resp.json()) as JsonTarget[];
  }

  /**
   * Try to find a Playwright Page that corresponds to a registered webview target.
   * Returns null if no safe page can be found.
   */
  private async findWebviewPage(
    allPages: Page[],
    target: CdpTargetInfo | undefined,
  ): Promise<Page | null> {
    // Strategy 1: Match by targetId → URL from /json endpoint
    if (target) {
      try {
        const jsonTargets = await this.fetchJsonTargets();
        const jsonTarget = jsonTargets.find((t) => t.id === target.targetId);
        if (jsonTarget && !isElectronShellUrl(jsonTarget.url)) {
          // Find Playwright page with matching URL
          const matched = allPages.find((p) => p.url() === jsonTarget.url);
          if (matched) return matched;

          // URL might differ slightly (trailing slash, redirect) — try loose match
          const normalizedTarget = jsonTarget.url.replace(/\/+$/, '');
          const looseMatch = allPages.find(
            (p) => p.url().replace(/\/+$/, '') === normalizedTarget,
          );
          if (looseMatch) return looseMatch;
        }
      } catch {
        // /json fetch failed
      }
    }

    // Strategy 2: Any page that isn't the Electron shell
    // about:blank is allowed — webviews start there before navigating
    const candidates = allPages.filter((p) => !isElectronShellUrl(p.url()));
    if (candidates.length > 0) {
      return candidates[0];
    }

    return null;
  }

  /**
   * Get a Page matching the given surfaceId.
   *
   * Includes retry logic: if no webview page is found on the first attempt,
   * reconnects to CDP (to discover newly created webview targets) and retries.
   */
  async getPage(surfaceId?: string): Promise<Page | null> {
    await this.ensureConnected();

    for (let attempt = 1; attempt <= PAGE_FIND_RETRIES; attempt++) {
      const allPages = this.getAllPages();
      if (allPages.length === 0 && attempt < PAGE_FIND_RETRIES) {
        // No pages yet — reconnect to discover new targets
        await sleep(PAGE_FIND_DELAY_MS);
        await this.reconnect();
        continue;
      }

      // Get registered webview targets
      const info = (await sendRpc('browser.cdp.info')) as CdpInfoResponse;
      const target = surfaceId
        ? info.targets.find((t) => t.surfaceId === surfaceId)
        : info.targets[0];

      // If no targets registered yet, wait for webview to initialize
      if (!target && attempt < PAGE_FIND_RETRIES) {
        console.log(
          `[PlaywrightEngine] No CDP targets registered yet, retry ${attempt}/${PAGE_FIND_RETRIES}...`,
        );
        await sleep(PAGE_FIND_DELAY_MS);
        // Reconnect to pick up newly created webview targets
        await this.reconnect();
        continue;
      }

      const page = await this.findWebviewPage(allPages, target);
      if (page) return page;

      // Page not found — reconnect and retry (new webview might not be visible yet)
      if (attempt < PAGE_FIND_RETRIES) {
        console.log(
          `[PlaywrightEngine] Webview page not found, reconnecting... (${attempt}/${PAGE_FIND_RETRIES})`,
        );
        await sleep(PAGE_FIND_DELAY_MS);
        await this.reconnect();
      }
    }

    console.warn('[PlaywrightEngine] No webview page found after all retries');
    return null;
  }

  async getBrowser(): Promise<Browser | null> {
    await this.ensureConnected();
    return this.browser;
  }
}

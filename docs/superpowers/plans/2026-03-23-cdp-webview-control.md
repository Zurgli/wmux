# CDP-Based Webview Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Playwright MCP to directly control wmux's browser webview via Chrome DevTools Protocol, eliminating cross-origin iframe restrictions.

**Architecture:** Main process attaches `webContents.debugger` to the webview guest when it becomes ready (dom-ready IPC from renderer). A `WebviewCdpManager` tracks active CDP sessions and exposes target info via a new `browser.cdp.target` RPC method. Playwright connects to the webview's CDP WebSocket URL instead of the main renderer.

**Tech Stack:** Electron 41 (`webContents.debugger` API), existing named pipe RPC, Zod schemas for MCP tools.

**Spec:** `docs/superpowers/specs/2026-03-23-cdp-webview-control-design.md`

---

### Task 1: Add `browser.cdp.target` to RPC types

**Files:**
- Modify: `src/shared/rpc.ts:36-43` (RpcMethod union), `src/shared/rpc.ts:67-74` (ALL_RPC_METHODS array)

- [ ] **Step 1: Add method to RpcMethod union**

In `src/shared/rpc.ts`, add `'browser.cdp.target'` after `'browser.type.humanlike'` in the union type:

```typescript
  | 'browser.cdp.target'
```

- [ ] **Step 2: Add method to ALL_RPC_METHODS array**

In the same file, add `'browser.cdp.target'` to the `ALL_RPC_METHODS` array in the browser section:

```typescript
  'browser.cdp.target',
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: No new errors related to rpc.ts

- [ ] **Step 4: Commit**

```bash
git add src/shared/rpc.ts
git commit -m "feat: add browser.cdp.target RPC method type"
```

---

### Task 2: Create WebviewCdpManager

**Files:**
- Create: `src/main/browser-session/WebviewCdpManager.ts`
- Create: `src/main/browser-session/__tests__/WebviewCdpManager.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/main/browser-session/__tests__/WebviewCdpManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebviewCdpManager } from '../WebviewCdpManager';

// Mock Electron's webContents
const mockDebugger = { attach: vi.fn(), detach: vi.fn() };
const mockWebContents = {
  debugger: mockDebugger,
  isDestroyed: vi.fn(() => false),
  on: vi.fn(),
  getURL: vi.fn(() => 'https://example.com'),
  getTitle: vi.fn(() => 'Example Page'),
  loadURL: vi.fn(),
};

vi.mock('electron', () => ({
  webContents: {
    fromId: vi.fn(() => mockWebContents),
  },
}));

// Mock fetch for /json endpoint
const mockTargets = [
  {
    id: 'target-abc',
    type: 'page',
    url: 'https://example.com',
    webSocketDebuggerUrl: 'ws://127.0.0.1:18800/devtools/page/target-abc',
  },
];
global.fetch = vi.fn(() =>
  Promise.resolve({ json: () => Promise.resolve(mockTargets) } as Response),
);

describe('WebviewCdpManager', () => {
  let manager: WebviewCdpManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new WebviewCdpManager(18800);
  });

  it('register attaches debugger and stores session', async () => {
    await manager.register('surface-1', 42);

    expect(mockDebugger.attach).toHaveBeenCalledWith('1.3');
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:18800/json');

    const target = manager.getTarget('surface-1');
    expect(target).not.toBeNull();
    expect(target?.targetId).toBe('target-abc');
    expect(target?.wsUrl).toContain('ws://');
  });

  it('unregister detaches debugger and removes session', async () => {
    await manager.register('surface-1', 42);
    manager.unregister('surface-1');

    expect(mockDebugger.detach).toHaveBeenCalled();
    expect(manager.getTarget('surface-1')).toBeNull();
  });

  it('getTarget without surfaceId returns first available', async () => {
    await manager.register('surface-1', 42);
    const target = manager.getTarget();
    expect(target).not.toBeNull();
  });

  it('listTargets returns all sessions', async () => {
    await manager.register('s1', 42);
    const list = manager.listTargets();
    expect(list).toHaveLength(1);
    expect(list[0].surfaceId).toBe('s1');
  });

  it('waitForTarget resolves when target is already registered', async () => {
    await manager.register('surface-1', 42);
    const target = await manager.waitForTarget('surface-1', 1000);
    expect(target.targetId).toBe('target-abc');
  });

  it('waitForTarget resolves when target registers later', async () => {
    const promise = manager.waitForTarget('surface-2', 3000);
    // Register after a short delay
    setTimeout(() => manager.register('surface-2', 99), 50);
    const target = await promise;
    expect(target).not.toBeNull();
  });

  it('waitForTarget rejects on timeout', async () => {
    await expect(manager.waitForTarget('nonexistent', 100)).rejects.toThrow('timeout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/browser-session/__tests__/WebviewCdpManager.test.ts 2>&1 | tail -10`
Expected: FAIL — `WebviewCdpManager` module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/main/browser-session/WebviewCdpManager.ts
import { webContents } from 'electron';

export interface CdpTargetInfo {
  surfaceId: string;
  webContentsId: number;
  targetId: string;
  wsUrl: string;
}

/**
 * Manages CDP debugging sessions for browser webview surfaces.
 *
 * When a webview's dom-ready fires, the renderer sends its webContentsId here.
 * We attach Electron's debugger to expose it as a CDP target, then fetch /json
 * to find its WebSocket URL for Playwright to connect to.
 */
export class WebviewCdpManager {
  private sessions = new Map<string, CdpTargetInfo>();
  private waiters = new Map<string, Array<(target: CdpTargetInfo) => void>>();
  private cdpPort: number;

  constructor(cdpPort = 18800) {
    this.cdpPort = cdpPort;
  }

  /**
   * Register a webview for CDP debugging.
   * Attaches debugger and discovers the CDP target URL.
   */
  async register(surfaceId: string, webContentsId: number): Promise<void> {
    // Clean up previous session for this surface if any
    if (this.sessions.has(surfaceId)) {
      this.unregister(surfaceId);
    }

    const wc = webContents.fromId(webContentsId);
    if (!wc || wc.isDestroyed()) {
      console.warn(`[WebviewCdpManager] webContents ${webContentsId} not found or destroyed`);
      return;
    }

    // Attach debugger to make this webContents visible as a CDP target
    try {
      wc.debugger.attach('1.3');
    } catch (err) {
      // Already attached is fine
      if (!String(err).includes('Already attached')) {
        console.error(`[WebviewCdpManager] debugger.attach failed:`, err);
        return;
      }
    }

    // Fetch /json to discover target info
    let targetId = `wc-${webContentsId}`;
    let wsUrl = `ws://127.0.0.1:${this.cdpPort}/devtools/page/${targetId}`;

    try {
      const resp = await fetch(`http://127.0.0.1:${this.cdpPort}/json`);
      const targets: Array<{ id: string; webSocketDebuggerUrl: string; url: string; title: string }> =
        await resp.json();

      // Match by URL or pick the non-main-renderer target
      const wcUrl = wc.getURL();
      const match = targets.find(
        (t) => t.url === wcUrl || t.title === wc.getTitle(),
      );
      if (match) {
        targetId = match.id;
        wsUrl = match.webSocketDebuggerUrl;
      }
    } catch (err) {
      console.warn(`[WebviewCdpManager] /json fetch failed, using fallback:`, err);
    }

    const info: CdpTargetInfo = { surfaceId, webContentsId, targetId, wsUrl };
    this.sessions.set(surfaceId, info);

    // Auto-cleanup when webContents is destroyed (crash, close, reload)
    wc.on('destroyed', () => {
      this.unregister(surfaceId);
    });

    // Resolve any pending waiters
    const pending = this.waiters.get(surfaceId);
    if (pending) {
      for (const resolve of pending) resolve(info);
      this.waiters.delete(surfaceId);
    }

    console.log(`[WebviewCdpManager] Registered surface=${surfaceId} target=${targetId}`);
  }

  /** Unregister a webview and detach its debugger. */
  unregister(surfaceId: string): void {
    const session = this.sessions.get(surfaceId);
    if (!session) return;

    try {
      const wc = webContents.fromId(session.webContentsId);
      if (wc && !wc.isDestroyed()) {
        wc.debugger.detach();
      }
    } catch {
      // Already detached or destroyed
    }

    this.sessions.delete(surfaceId);
    console.log(`[WebviewCdpManager] Unregistered surface=${surfaceId}`);
  }

  /** Get CDP target info for a specific surface, or the first available. */
  getTarget(surfaceId?: string): CdpTargetInfo | null {
    if (surfaceId) {
      return this.sessions.get(surfaceId) ?? null;
    }
    // Return first available
    const first = this.sessions.values().next();
    return first.done ? null : first.value;
  }

  /** Wait for a target to be registered, with timeout. */
  waitForTarget(surfaceId: string, timeoutMs = 5000): Promise<CdpTargetInfo> {
    const existing = this.sessions.get(surfaceId);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.waiters.get(surfaceId);
        if (pending) {
          const idx = pending.indexOf(resolve);
          if (idx >= 0) pending.splice(idx, 1);
          if (pending.length === 0) this.waiters.delete(surfaceId);
        }
        reject(new Error(`timeout waiting for CDP target: ${surfaceId}`));
      }, timeoutMs);

      const wrappedResolve = (target: CdpTargetInfo) => {
        clearTimeout(timer);
        resolve(target);
      };

      if (!this.waiters.has(surfaceId)) {
        this.waiters.set(surfaceId, []);
      }
      this.waiters.get(surfaceId)!.push(wrappedResolve);
    });
  }

  /** List all active CDP targets. */
  listTargets(): CdpTargetInfo[] {
    return [...this.sessions.values()];
  }

  /** Clean up all sessions. */
  disposeAll(): void {
    for (const surfaceId of [...this.sessions.keys()]) {
      this.unregister(surfaceId);
    }
    this.waiters.clear();
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/main/browser-session/__tests__/WebviewCdpManager.test.ts 2>&1 | tail -15`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/browser-session/WebviewCdpManager.ts src/main/browser-session/__tests__/WebviewCdpManager.test.ts
git commit -m "feat: add WebviewCdpManager for CDP webview debugging"
```

---

### Task 3: Add IPC for webview registration

**Files:**
- Modify: `src/preload/preload.ts` (add `browser.registerWebview`)
- Modify: `src/main/index.ts` (add IPC handler + instantiate WebviewCdpManager)

- [ ] **Step 1: Add browser API to preload**

In `src/preload/preload.ts`, find the `rpc:` section and add a `browser:` section right after it. Look for the pattern of existing API sections.

Add after the `rpc` section (around line 79):

```typescript
    browser: {
      registerWebview: (surfaceId: string, webContentsId: number) =>
        ipcRenderer.invoke('browser:register-webview', surfaceId, webContentsId),
    },
```

- [ ] **Step 2: Add IPC handler and WebviewCdpManager to main process**

In `src/main/index.ts`:

Add import at the top (after other imports around line 33):
```typescript
import { WebviewCdpManager } from './browser-session/WebviewCdpManager';
```

Modify the existing electron import on line 16 to include `ipcMain`:
```typescript
import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
```

After `const mcpRegistrar = new McpRegistrar();` (line 74), add:
```typescript
const cdpPort = Number(process.env.WMUX_CDP_PORT) || 18800;
const webviewCdpManager = new WebviewCdpManager(cdpPort);
```

After `registerBrowserRpc(rpcRouter, () => mainWindow);` (line 138), add:
```typescript

// IPC: webview CDP registration
ipcMain.handle('browser:register-webview', async (_event, surfaceId: string, webContentsId: number) => {
  await webviewCdpManager.register(surfaceId, webContentsId);
  return { ok: true };
});
```

In the `before-quit` handler (around line 211, before `pipeServer.stop()`), add:
```typescript
  webviewCdpManager.disposeAll();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: No errors (registerBrowserRpc signature update deferred to Task 4)

- [ ] **Step 4: Commit**

```bash
git add src/preload/preload.ts src/main/index.ts
git commit -m "feat: add webview CDP registration IPC and WebviewCdpManager wiring"
```

---

### Task 4: Add `browser.cdp.target` RPC handler

**Files:**
- Modify: `src/main/pipe/handlers/browser.rpc.ts` (add parameter, add handler)

- [ ] **Step 1: Update function signature and wire in main**

In `src/main/pipe/handlers/browser.rpc.ts`, update the import and function signature:

Add import at top:
```typescript
import { webContents } from 'electron';
import { WebviewCdpManager } from '../../browser-session/WebviewCdpManager';
```

Change the function signature (line 32):
```typescript
export function registerBrowserRpc(router: RpcRouter, getWindow: GetWindow, webviewCdpManager: WebviewCdpManager): void {
```

Then in `src/main/index.ts`, update the `registerBrowserRpc` call (line 138) to pass the manager:
```typescript
registerBrowserRpc(rpcRouter, () => mainWindow, webviewCdpManager);
```

- [ ] **Step 2: Add browser.cdp.target handler**

Add before the closing `}` of `registerBrowserRpc` (before line 170):

```typescript
  /**
   * browser.cdp.target
   * Returns the CDP WebSocket URL for the active browser webview.
   * Playwright MCP uses this to connect to the correct target.
   * params: { surfaceId?: string }
   */
  router.register('browser.cdp.target', async (params) => {
    const surfaceId = typeof params['surfaceId'] === 'string' ? params['surfaceId'] : undefined;

    if (surfaceId) {
      try {
        const target = await webviewCdpManager.waitForTarget(surfaceId, 5000);
        return {
          webSocketDebuggerUrl: target.wsUrl,
          targetId: target.targetId,
          surfaceId: target.surfaceId,
        };
      } catch {
        return { error: 'timeout waiting for webview CDP target' };
      }
    }

    const target = webviewCdpManager.getTarget();
    if (!target) return { error: 'no active browser webview' };

    return {
      webSocketDebuggerUrl: target.wsUrl,
      targetId: target.targetId,
      surfaceId: target.surfaceId,
    };
  });
```

- [ ] **Step 3: Update browser.navigate to use CDP when available**

Replace the existing `browser.navigate` handler (lines 63-73) with:

```typescript
  router.register('browser.navigate', async (params) => {
    if (typeof params['url'] !== 'string' || params['url'].length === 0) {
      throw new Error('browser.navigate: missing required param "url"');
    }
    validateUrl(params['url'], 'browser.navigate');
    const surfaceId = typeof params['surfaceId'] === 'string' ? params['surfaceId'] : undefined;

    // Try CDP direct navigation first (webContents imported at top of file)
    const target = webviewCdpManager.getTarget(surfaceId);
    if (target) {
      try {
        const wc = webContents.fromId(target.webContentsId);
        if (wc && !wc.isDestroyed()) {
          await wc.loadURL(params['url']);
          return { ok: true, url: params['url'] };
        }
      } catch (err) {
        console.warn('[browser.navigate] CDP fallback to renderer:', err);
      }
    }

    // Fallback to renderer bridge
    return sendToRenderer(getWindow, 'browser.navigate', {
      url: params['url'],
      ...(surfaceId && { surfaceId }),
    });
  });
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/main/pipe/handlers/browser.rpc.ts
git commit -m "feat: add browser.cdp.target RPC handler and CDP-direct navigation"
```

---

### Task 5: Send webContentsId from BrowserPanel on dom-ready

**Files:**
- Modify: `src/renderer/components/Browser/BrowserPanel.tsx`

- [ ] **Step 1: Add webview registration on dom-ready**

In `src/renderer/components/Browser/BrowserPanel.tsx`, find the `onDomReady` handler inside the `useEffect` (around line 87). Replace it:

```typescript
    const onDomReady = () => {
      setIsReady(true);
      updateNavState();

      // Register webview with main process for CDP debugging
      try {
        const wcId = (wv as any).getWebContentsId?.();
        if (wcId && (window as any).electronAPI?.browser?.registerWebview) {
          (window as any).electronAPI.browser.registerWebview(surfaceId, wcId);
        }
      } catch (err) {
        console.warn('[BrowserPanel] Failed to register webview for CDP:', err);
      }
    };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: No errors (using `any` cast avoids type issues with getWebContentsId)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Browser/BrowserPanel.tsx
git commit -m "feat: register webview webContentsId on dom-ready for CDP"
```

---

### Task 6: Add `browser_cdp_target` MCP tool

**Files:**
- Modify: `src/mcp/index.ts`

- [ ] **Step 1: Add the tool definition**

In `src/mcp/index.ts`, after the `browser_type_humanlike` tool (around line 100), add:

```typescript
// CDP target discovery
server.tool(
  'browser_cdp_target',
  'Get the CDP WebSocket URL for the active browser webview. Use this to connect Playwright to the correct target.',
  {
    surfaceId: z.string().optional().describe('Target a specific browser surface'),
  },
  async ({ surfaceId }) => callRpc('browser.cdp.target', { surfaceId }),
);
```

- [ ] **Step 2: Build MCP server**

Run: `npm run build:mcp 2>&1 | tail -5`
Expected: Build succeeds, `dist/mcp-bundle/index.js` created

- [ ] **Step 3: Commit**

```bash
git add src/mcp/index.ts
git commit -m "feat: add browser_cdp_target MCP tool for Playwright CDP discovery"
```

---

### Task 7: Integration test — manual verification

- [ ] **Step 1: Start wmux**

Run: `npm start` (in a separate terminal)

- [ ] **Step 2: Open a browser surface**

Via MCP or command palette, open a browser surface with a URL (e.g., `https://www.naver.com`)

- [ ] **Step 3: Verify CDP target appears**

Run in a terminal:
```bash
curl http://127.0.0.1:18800/json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const t=JSON.parse(d);t.forEach(x=>console.log(x.type,x.title,x.url))"
```

Expected: Should show at least two entries — one `page` (wmux renderer) and one for the webview target.

- [ ] **Step 4: Verify browser.cdp.target RPC**

Using the wmux MCP, call `browser_cdp_target`. It should return:
```json
{
  "webSocketDebuggerUrl": "ws://127.0.0.1:18800/devtools/page/...",
  "targetId": "...",
  "surfaceId": "..."
}
```

- [ ] **Step 5: Test Playwright connection**

Have Claude Code use Playwright MCP to interact with the webview (click, fill, navigate). Cross-origin iframes should now be accessible.

- [ ] **Step 6: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: CDP-based webview control — Playwright can now directly control browser surfaces"
```

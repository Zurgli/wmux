/**
 * AutoUpdater
 *
 * update.electronjs.org 기반 자동 업데이트 시스템.
 * Chromium의 net 모듈로 업데이트를 확인하고, Squirrel의 Update.exe로 설치.
 *
 * Electron 내장 autoUpdater(Squirrel의 .NET HttpWebRequest)는
 * GitHub의 다중 302 redirect + TLS 1.2에서 실패하므로 사용하지 않음.
 */

import { autoUpdater, app, type BrowserWindow, ipcMain, net, shell } from 'electron';
import { IPC } from '../../shared/constants';

const REPO = 'openwong2kim/wmux';
const UPDATE_SERVER = `https://update.electronjs.org/${REPO}/win32/${app.getVersion()}`;

// 업데이트 자동 확인 간격 (30분)
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

interface UpdateInfo {
  name: string;
  notes: string;
  url: string;
}

export class AutoUpdater {
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private getWindow: () => BrowserWindow | null;
  private isChecking = false;
  private enabled = true;
  private pendingUpdate: UpdateInfo | null = null;

  constructor(getWindow: () => BrowserWindow | null) {
    this.getWindow = getWindow;
  }

  start(): void {
    this.registerIpcHandlers();

    if (process.env.NODE_ENV === 'development') {
      return;
    }

    // 앱 시작 후 15초 뒤 첫 번째 확인 (시작 부하 방지)
    setTimeout(() => this.check(), 15_000);

    // 이후 주기적 확인
    this.checkTimer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[AutoUpdater] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  stop(): void {
    if (this.checkTimer !== null) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    ipcMain.removeAllListeners(IPC.AUTO_UPDATE_ENABLED);
    ipcMain.removeHandler(IPC.UPDATE_CHECK);
    ipcMain.removeHandler(IPC.UPDATE_INSTALL);
  }

  private async check(): Promise<void> {
    if (!this.enabled || this.isChecking) return;
    this.isChecking = true;
    this.sendToRenderer(IPC.UPDATE_CHECK, { status: 'checking' });

    try {
      const update = await this.fetchUpdate();
      if (update) {
        this.pendingUpdate = update;
        this.sendToRenderer(IPC.UPDATE_AVAILABLE, {
          status: 'available',
          releaseName: update.name,
          releaseNotes: update.notes,
        });
      } else {
        this.sendToRenderer(IPC.UPDATE_NOT_AVAILABLE, { status: 'not-available' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[AutoUpdater] check error:', message);
      this.sendToRenderer(IPC.UPDATE_ERROR, { status: 'error', message });
    } finally {
      this.isChecking = false;
    }
  }

  private fetchUpdate(): Promise<UpdateInfo | null> {
    return new Promise((resolve, reject) => {
      const request = net.request(UPDATE_SERVER);
      let body = '';

      request.on('response', (response) => {
        // 204 = no update available
        if (response.statusCode === 204) {
          resolve(null);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Update server returned ${response.statusCode}`));
          return;
        }
        response.on('data', (chunk) => { body += chunk.toString(); });
        response.on('end', () => {
          try {
            const data = JSON.parse(body) as UpdateInfo;
            resolve(data);
          } catch {
            reject(new Error('Invalid JSON from update server'));
          }
        });
      });

      request.on('error', (err) => reject(err));
      request.end();
    });
  }

  private registerIpcHandlers(): void {
    ipcMain.on(IPC.AUTO_UPDATE_ENABLED, (_event, enabled: boolean) => {
      this.setEnabled(enabled);
    });

    ipcMain.handle(IPC.UPDATE_CHECK, async () => {
      if (process.env.NODE_ENV === 'development') {
        return { status: 'not-available' };
      }
      // Don't await — fire and forget, results come via IPC events
      this.check();
      return { status: 'checking' };
    });

    ipcMain.handle(IPC.UPDATE_INSTALL, async () => {
      if (!this.pendingUpdate) return;

      const win = this.getWindow();
      if (win && !win.isDestroyed() && !win.webContents.isCrashed()) {
        try {
          await win.webContents.executeJavaScript(
            `try { window.dispatchEvent(new Event('beforeunload')); } catch(e) {}`
          );
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[AutoUpdater] Session save triggered before update install');
        } catch {
          console.warn('[AutoUpdater] Could not trigger session save before update');
        }
      }

      // Open the Setup.exe download URL — user installs the new version
      shell.openExternal(this.pendingUpdate.url);
    });
  }

  private sendToRenderer(channel: string, data: Record<string, unknown>): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

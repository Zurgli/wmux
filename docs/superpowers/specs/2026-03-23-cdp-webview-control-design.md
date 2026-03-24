# CDP-Based Webview Control Design

## Problem

Playwright MCP connects to wmux's Electron CDP endpoint (`localhost:18800`) but targets the main renderer page, not the `<webview>` guest process. This causes:
- Cross-origin iframe restrictions when trying to interact with page content
- Playwright cannot find or control the webview's DOM
- `browser.*` RPC handlers relay through renderer IPC, adding latency and fragility

## Solution

Explicitly attach the Electron debugger to webview guest `webContents` and expose CDP target info so Playwright MCP can discover and control the webview directly.

## Architecture

```
Claude Code
    |
    ├── wmux MCP (pipe) ──→ browser.* RPC ──→ WebviewCdpManager (main process)
    |                                              |
    └── Playwright MCP ──→ CDP localhost:18800 ────┘
                                |
                           webContents.debugger.attach()
                                |
                           <webview> guest process
                                |
                           actual web page (naver.com, etc.)
```

## Important Assumptions & Validations

1. **Webview targets may NOT auto-appear in `/json`:** Electron's `--remote-debugging-port` lists the main renderer but webview guest processes may not appear automatically. We must explicitly call `webContents.debugger.attach('1.3')` on the webview's webContents to make it a CDP-debuggable target.

2. **`getWebContentsId()`:** Available on `<webview>` element in renderer, but only after `dom-ready`. TypeScript may need type augmentation.

3. **`webContents.fromId()` deprecation:** Check Electron version. If Electron 35+, use alternative lookup. Current wmux Electron version should be verified.

4. **CDP port binds to 127.0.0.1 only:** Electron binds CDP to localhost by default (no external access). This is acceptable.

## Components

### 1. WebviewCdpManager (new)

**File:** `src/main/browser-session/WebviewCdpManager.ts`

Manages CDP debugging sessions for webview surfaces.

```typescript
class WebviewCdpManager {
  // Track active webview webContents by surfaceId
  private sessions: Map<string, {
    webContentsId: number;
    targetId: string;
    wsUrl: string;
  }>;

  // Pending resolve callbacks for waitForTarget()
  private waiters: Map<string, Array<(target: TargetInfo) => void>>;

  // Called when a browser surface's webview becomes ready.
  // Attaches debugger, fetches /json to find targetId and wsUrl.
  async register(surfaceId: string, webContentsId: number): Promise<void> {
    const wc = webContents.fromId(webContentsId);
    // Attach debugger to make this webContents appear as CDP target
    wc.debugger.attach('1.3');

    // Fetch target list to find this webview's wsUrl
    const targets = await fetch(`http://127.0.0.1:${cdpPort}/json`).then(r => r.json());
    const target = targets.find(t => /* match by webContentsId or URL */);

    this.sessions.set(surfaceId, { webContentsId, targetId: target.id, wsUrl: target.webSocketDebuggerUrl });

    // Auto-cleanup on destroy (crash, close, renderer reload)
    wc.on('destroyed', () => this.unregister(surfaceId));

    // Resolve any pending waiters
    this.resolveWaiters(surfaceId);
  }

  // Called when a browser surface is closed
  unregister(surfaceId: string): void {
    const session = this.sessions.get(surfaceId);
    if (session) {
      try {
        const wc = webContents.fromId(session.webContentsId);
        if (wc && !wc.isDestroyed()) wc.debugger.detach();
      } catch { /* already gone */ }
      this.sessions.delete(surfaceId);
    }
  }

  // Get CDP target info. Returns null if webview not ready yet.
  getTarget(surfaceId?: string): TargetInfo | null;

  // Wait for a webview to be registered (with timeout).
  // Solves race condition: browser.open → immediate browser.cdp.target
  async waitForTarget(surfaceId: string, timeoutMs = 5000): Promise<TargetInfo>;

  // List all active webview CDP targets
  listTargets(): TargetInfo[];
}
```

**Key behaviors:**
- `register()` calls `webContents.debugger.attach('1.3')` — this is required for the webview to appear as a CDP target
- Fetches `http://127.0.0.1:{port}/json` to get the `webSocketDebuggerUrl` and `targetId`
- Listens for `destroyed` event on webContents to auto-unregister (handles crashes, renderer reloads)
- `waitForTarget()` returns a promise that resolves when registration completes — solves the race between `browser.open` and `browser.cdp.target`

### 2. IPC: Webview Registration

When `BrowserPanel`'s webview fires `dom-ready`, the renderer sends the webview's `webContentsId` to the main process.

**Renderer side (BrowserPanel.tsx):**
```typescript
const onDomReady = () => {
  // getWebContentsId() is available on <webview> after dom-ready
  const wcId = (webviewRef.current as any)?.getWebContentsId?.();
  if (wcId) {
    window.electronAPI.browser.registerWebview(surfaceId, wcId);
  }
};
```

**Main side (new IPC handler):**
```typescript
ipcMain.handle('browser:register-webview', async (_event, surfaceId, webContentsId) => {
  await webviewCdpManager.register(surfaceId, webContentsId);
  return { ok: true };
});
```

**Preload (expose API):**
```typescript
browser: {
  registerWebview: (surfaceId: string, webContentsId: number) =>
    ipcRenderer.invoke('browser:register-webview', surfaceId, webContentsId),
}
```

### 3. Updated browser.* RPC Handlers

`browser.rpc.ts` handlers that currently delegate to renderer via `sendToRenderer()` will use `WebviewCdpManager` for direct control from the main process.

URL validation is unified: both main and renderer use the same blocklist (`BLOCKED_SCHEMES`) plus an allowlist check for `http:` and `https:` only.

**browser.navigate:**
```typescript
router.register('browser.navigate', async (params) => {
  const surfaceId = params.surfaceId as string | undefined;
  const url = params.url as string;
  validateUrl(url, 'browser.navigate');

  const target = webviewCdpManager.getTarget(surfaceId);
  if (target) {
    const wc = webContents.fromId(target.webContentsId);
    if (wc && !wc.isDestroyed()) {
      await wc.loadURL(url);
      return { ok: true, url };
    }
  }

  // Fallback to renderer bridge if CDP target not yet registered
  return sendToRenderer(getWindow, 'browser.navigate', { url, surfaceId });
});
```

### 4. New RPC Method: browser.cdp.target

Returns the webview's CDP WebSocket URL for Playwright to connect to.

```typescript
router.register('browser.cdp.target', async (params) => {
  const surfaceId = params.surfaceId as string | undefined;

  // If surfaceId given, wait for that specific target (handles race with browser.open)
  if (surfaceId) {
    try {
      const target = await webviewCdpManager.waitForTarget(surfaceId, 5000);
      return {
        webSocketDebuggerUrl: target.wsUrl,
        targetId: target.targetId,
      };
    } catch {
      return { error: 'timeout waiting for webview CDP target' };
    }
  }

  // No surfaceId — return first available target
  const target = webviewCdpManager.getTarget();
  if (!target) return { error: 'no active browser webview' };

  return {
    webSocketDebuggerUrl: target.wsUrl,
    targetId: target.targetId,
  };
});
```

### 5. MCP Tool Definition

**In `src/mcp/index.ts`:**
```typescript
server.tool('browser_cdp_target', 'Get CDP WebSocket URL for the active browser webview', {
  surfaceId: z.string().optional().describe('Target a specific browser surface'),
}, async ({ surfaceId }) => {
  const result = await sendRpc('browser.cdp.target', { surfaceId });
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

## Files Changed

| File | Change |
|------|--------|
| `src/main/browser-session/WebviewCdpManager.ts` | **New** — CDP session manager with debugger.attach() |
| `src/main/pipe/handlers/browser.rpc.ts` | Update navigate/click/fill to use CDP; add `browser.cdp.target` |
| `src/main/index.ts` | Instantiate WebviewCdpManager, register IPC handler |
| `src/main/ipc/registerHandlers.ts` | Add `browser:register-webview` IPC handler |
| `src/preload/preload.ts` | Expose `browser.registerWebview` API |
| `src/renderer/components/Browser/BrowserPanel.tsx` | Send webContentsId on dom-ready |
| `src/mcp/index.ts` | Add `browser_cdp_target` tool |
| `src/shared/rpc.ts` | Add `browser.cdp.target` to RpcMethod union |

## Data Flow

### Browser Open + Navigate (after change)

```
1. MCP: browser.open({ url: "https://naver.com" })
2. RPC → renderer: addBrowserSurface to active pane
3. React renders <webview src="https://naver.com">
4. webview dom-ready → renderer sends webContentsId to main via IPC
5. main: WebviewCdpManager.register(surfaceId, webContentsId)
   5a. debugger.attach('1.3') on webContents
   5b. fetch /json → find targetId + wsUrl
   5c. store session, resolve any pending waiters
6. Playwright MCP: browser_cdp_target → waitForTarget() → returns wsUrl
7. Playwright connects to webview via CDP WebSocket
8. Playwright: click, fill, navigate → all work including cross-origin iframes
```

## Error Handling

- **Webview not ready:** `waitForTarget()` blocks up to 5s with promise; returns error on timeout
- **Webview destroyed (crash/close/reload):** `webContents.on('destroyed')` auto-unregisters and detaches debugger
- **Multiple webviews:** `surfaceId` parameter disambiguates; without it, returns first available target
- **CDP port conflict:** Existing `PortAllocator` handles (range 18800-18899)
- **debugger.attach() failure:** Logged and surfaced as error in register() response

## Testing

- Unit test: `WebviewCdpManager` register/unregister/getTarget/waitForTarget
- Integration: webview dom-ready triggers registration → debugger attached
- E2E: Playwright MCP connects via CDP and navigates/clicks in cross-origin iframe

## Migration

- Existing renderer-side `browser.navigate` handler remains as fallback (CDP not yet registered)
- No breaking changes to existing MCP tool interface
- New `browser_cdp_target` tool is additive
- Renderer bridge fallback can be removed in future once CDP path is proven stable

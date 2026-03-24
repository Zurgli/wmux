# Critical Stability Fixes for 24/7 Operation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical stability issues that prevent wmux from running 24/7/365 without crashing, leaking, or hanging.

**Architecture:** All changes are in the Electron main process. Each fix is independent — they can be applied in any order. The core pattern is: make IPC registration idempotent, add crash/hang recovery handlers, properly scope cleanup to both renderer-crash and app-quit paths.

**Tech Stack:** Electron (main process), Node.js, TypeScript

---

## File Map

| File | Changes |
|------|---------|
| `src/main/ipc/registerHandlers.ts` | Make all handlers removable; return comprehensive cleanup function |
| `src/main/ipc/handlers/pty.handler.ts` | Track `ipcMain.on` listener for removal; return cleanup function |
| `src/main/ipc/handlers/session.handler.ts` | Add `removeHandler` before `handle` (clipboard pattern) |
| `src/main/ipc/handlers/shell.handler.ts` | Add `removeHandler` before `handle` |
| `src/main/ipc/handlers/metadata.handler.ts` | Export `removeCwd` function; add `isLoading` guard |
| `src/main/ipc/handlers/fs.handler.ts` | Export `closeAllWatchers` function |
| `src/main/index.ts` | Add `unresponsive` handler; call cleanup+re-register on crash; save session before update |
| `src/main/updater/AutoUpdater.ts` | Save session synchronously before `quitAndInstall`; remove autoUpdater listeners in `stop()` |
| `src/main/pipe/PipeServer.ts` | Recreate server object on EADDRINUSE exhaustion; notify user on failure |
| `src/main/session/SessionManager.ts` | Export singleton for main-process access (used by AutoUpdater) |

---

### Task 1: C1 — Make IPC handler registration idempotent

**Problem:** `ipcMain.on(PTY_WRITE)` and `ipcMain.on(TOAST_ENABLED)` accumulate listeners after renderer crash/reload. `ipcMain.handle()` calls would throw on double-registration.

**Files:**
- Modify: `src/main/ipc/handlers/pty.handler.ts`
- Modify: `src/main/ipc/handlers/session.handler.ts`
- Modify: `src/main/ipc/handlers/shell.handler.ts`
- Modify: `src/main/ipc/handlers/metadata.handler.ts`
- Modify: `src/main/ipc/handlers/fs.handler.ts`
- Modify: `src/main/ipc/registerHandlers.ts`

- [ ] **Step 1: Make `pty.handler.ts` return a cleanup function**

Every `ipcMain.handle` must be preceded by `ipcMain.removeHandler`. The `ipcMain.on(PTY_WRITE)` listener must be tracked and returned for removal.

```typescript
// src/main/ipc/handlers/pty.handler.ts
export function registerPTYHandlers(ptyManager: PTYManager, ptyBridge: PTYBridge): () => void {
  // Remove any previous handlers (idempotent re-registration)
  ipcMain.removeHandler(IPC.PTY_CREATE);
  ipcMain.removeHandler(IPC.PTY_RESIZE);
  ipcMain.removeHandler(IPC.PTY_DISPOSE);
  ipcMain.removeHandler(IPC.PTY_LIST);
  ipcMain.removeHandler(IPC.PTY_RECONNECT);

  ipcMain.handle(IPC.PTY_CREATE, ...);  // existing code

  // Track the on() listener for cleanup
  const ptyWriteListener = (_event: Electron.IpcMainEvent, id: string, data: string) => {
    if (!ptyManager.get(id)) return;
    if (typeof data !== 'string') return;
    if (data.length > 100_000) return;
    ptyManager.write(id, data);
  };
  ipcMain.removeAllListeners(IPC.PTY_WRITE);  // remove previous
  ipcMain.on(IPC.PTY_WRITE, ptyWriteListener);

  ipcMain.handle(IPC.PTY_RESIZE, ...);  // existing code
  ipcMain.handle(IPC.PTY_DISPOSE, ...);
  ipcMain.handle(IPC.PTY_LIST, ...);
  ipcMain.handle(IPC.PTY_RECONNECT, ...);

  return () => {
    ipcMain.removeHandler(IPC.PTY_CREATE);
    ipcMain.removeHandler(IPC.PTY_RESIZE);
    ipcMain.removeHandler(IPC.PTY_DISPOSE);
    ipcMain.removeHandler(IPC.PTY_LIST);
    ipcMain.removeHandler(IPC.PTY_RECONNECT);
    ipcMain.removeListener(IPC.PTY_WRITE, ptyWriteListener);
  };
}
```

- [ ] **Step 2: Apply the same pattern to `session.handler.ts` and `shell.handler.ts`**

Add `ipcMain.removeHandler()` calls before each `ipcMain.handle()` — matching the pattern already used in `clipboard.handler.ts`.

```typescript
// session.handler.ts — return cleanup function
export function registerSessionHandlers(): () => void {
  ipcMain.removeHandler(IPC.SESSION_SAVE);
  ipcMain.removeHandler(IPC.SESSION_LOAD);
  ipcMain.handle(IPC.SESSION_SAVE, ...);
  ipcMain.handle(IPC.SESSION_LOAD, ...);
  return () => {
    ipcMain.removeHandler(IPC.SESSION_SAVE);
    ipcMain.removeHandler(IPC.SESSION_LOAD);
  };
}

// shell.handler.ts — same pattern
export function registerShellHandlers(): () => void {
  ipcMain.removeHandler(IPC.SHELL_LIST);
  ipcMain.handle(IPC.SHELL_LIST, ...);
  return () => {
    ipcMain.removeHandler(IPC.SHELL_LIST);
  };
}
```

- [ ] **Step 2b: Make `fs.handler.ts` idempotent and export `closeAllWatchers`**

Add `removeHandler` before each `handle`, and export a cleanup function:

```typescript
// src/main/ipc/handlers/fs.handler.ts
export function registerFsHandlers(): () => void {
  // Idempotent re-registration
  ipcMain.removeHandler(IPC.FS_READ_DIR);
  ipcMain.removeHandler(IPC.FS_READ_FILE);
  ipcMain.removeHandler(IPC.FS_WATCH);
  ipcMain.removeHandler(IPC.FS_UNWATCH);

  ipcMain.handle(IPC.FS_READ_DIR, ...);  // existing
  ipcMain.handle(IPC.FS_READ_FILE, ...);  // existing
  ipcMain.handle(IPC.FS_WATCH, ...);  // existing
  ipcMain.handle(IPC.FS_UNWATCH, ...);  // existing

  return () => {
    ipcMain.removeHandler(IPC.FS_READ_DIR);
    ipcMain.removeHandler(IPC.FS_READ_FILE);
    ipcMain.removeHandler(IPC.FS_WATCH);
    ipcMain.removeHandler(IPC.FS_UNWATCH);
    closeAllWatchers();
  };
}

export function closeAllWatchers(): void {
  for (const watcher of watchers.values()) watcher.close();
  watchers.clear();
  for (const timer of debounceTimers.values()) clearTimeout(timer);
  debounceTimers.clear();
}
```

- [ ] **Step 3: Update `registerAllHandlers` to collect all cleanups**

```typescript
// src/main/ipc/registerHandlers.ts
export function registerAllHandlers(
  ptyManager: PTYManager,
  ptyBridge: PTYBridge,
  getWindow: () => BrowserWindow | null,
): () => void {
  const cleanupPty = registerPTYHandlers(ptyManager, ptyBridge);
  const cleanupSession = registerSessionHandlers();
  const cleanupShell = registerShellHandlers();
  const cleanupMetadata = registerMetadataHandlers(ptyManager, getWindow);
  registerClipboardHandlers();  // already self-cleaning (removeHandler before handle)
  const cleanupFs = registerFsHandlers();

  // Sync toast setting from renderer
  ipcMain.removeAllListeners(IPC.TOAST_ENABLED);
  const toastListener = (_event: Electron.IpcMainEvent, enabled: boolean) => {
    toastManager.enabled = enabled;
  };
  ipcMain.on(IPC.TOAST_ENABLED, toastListener);

  return () => {
    cleanupPty();
    cleanupSession();
    cleanupShell();
    cleanupMetadata();
    cleanupFs();
    ipcMain.removeListener(IPC.TOAST_ENABLED, toastListener);
  };
}
```

- [ ] **Step 4: Verify — check the app starts without errors**

Run: `npm start`
Expected: App launches normally, no "duplicate handler" errors in console.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/
git commit -m "fix(ipc): make handler registration idempotent for crash recovery

All ipcMain.handle() calls now removeHandler() first. ipcMain.on()
listeners are tracked and returned for cleanup. registerAllHandlers()
returns a comprehensive cleanup function covering all handlers."
```

---

### Task 2: C2 — Add `unresponsive` event handler + re-register on crash

**Problem:** If the renderer hangs, the app freezes with no recovery. On renderer crash, IPC handlers are not re-registered (they survive but accumulate if `on()` is used).

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add `unresponsive` handler and fix crash recovery in `index.ts`**

In the `app.on('ready')` block, after the existing `render-process-gone` handler:

```typescript
// index.ts — inside app.on('ready', () => { ... })

// Make cleanupHandlers reassignable for crash recovery
let cleanupHandlers = registerAllHandlers(ptyManager, ptyBridge, () => mainWindow);

// ... existing render-process-gone handler, MODIFIED:
mainWindow.webContents.on('render-process-gone', (_event, details) => {
  console.error('[Main] Renderer crashed:', details.reason, details.exitCode);
  if (details.reason === 'clean-exit') return;
  // ... existing crash counting logic ...

  // Clean up old handlers and re-register (prevents accumulation)
  cleanupHandlers();
  cleanupHandlers = registerAllHandlers(ptyManager, ptyBridge, () => mainWindow);

  const activePtys = ptyManager.getActiveInstances();
  console.log(`[Main] ${activePtys.length} PTY(s) still alive — reloading renderer`);
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
  }, 1000);
});

// NEW: Handle hung renderer
let unresponsiveTimer: ReturnType<typeof setTimeout> | null = null;
mainWindow.on('unresponsive', () => {
  console.warn('[Main] Renderer is unresponsive');
  if (unresponsiveTimer) return; // already waiting
  unresponsiveTimer = setTimeout(() => {
    unresponsiveTimer = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.warn('[Main] Renderer still unresponsive after 10s — reloading');
      cleanupHandlers();
      cleanupHandlers = registerAllHandlers(ptyManager, ptyBridge, () => mainWindow);
      mainWindow.reload();
    }
  }, 10_000);
});

mainWindow.on('responsive', () => {
  if (unresponsiveTimer) {
    clearTimeout(unresponsiveTimer);
    unresponsiveTimer = null;
    console.log('[Main] Renderer recovered from unresponsive state');
  }
});
```

Note: `cleanupHandlers` must be changed from `const` to `let` at the module level (line 53) to allow reassignment.

- [ ] **Step 2: Move `cleanupHandlers` to `let` at module scope**

Change line 53 from:
```typescript
const cleanupHandlers = registerAllHandlers(...)
```
to:
```typescript
let cleanupHandlers = registerAllHandlers(...)
```

And update the `before-quit` handler to use the same variable.

- [ ] **Step 3: Verify — force a renderer hang and confirm recovery**

Run: `npm start`
In DevTools console: `while(true) {}` (forces hang)
Expected: After 10 seconds, the app reloads automatically. Console shows "Renderer is unresponsive" → "reloading".

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "fix(stability): add unresponsive handler and re-register IPC on crash

- Add BrowserWindow.on('unresponsive') with 10s grace period before auto-reload
- Add BrowserWindow.on('responsive') to cancel reload if renderer recovers
- Re-register IPC handlers after renderer crash (cleanup old → register new)
- Prevents IPC listener accumulation across crash/reload cycles"
```

---

### Task 3: C3 — Fix metadata polling interval leak on renderer crash

**Problem:** The 5-second `setInterval` in `metadata.handler.ts` is never cleared on renderer crash — only on app quit. It spawns PowerShell processes continuously.

**Files:**
- Modify: `src/main/ipc/handlers/metadata.handler.ts`

- [ ] **Step 1: Add `isLoading` guard and export `removeCwd`**

The cleanup function returned by `registerMetadataHandlers` already clears the interval. Since Task 1 makes `registerAllHandlers` call cleanup before re-registration, the interval IS now cleared on crash recovery. However, we still need:

1. A guard against sending IPC while renderer is loading
2. An exported `removeCwd` for PTYBridge cleanup

```typescript
// src/main/ipc/handlers/metadata.handler.ts

export function registerMetadataHandlers(
  ptyManager: PTYManager,
  getWindow: () => BrowserWindow | null,
): () => void {
  // Remove previous handler (idempotent)
  ipcMain.removeHandler(IPC.METADATA_REQUEST);

  ipcMain.handle(IPC.METADATA_REQUEST, async (_event, ptyId: string) => {
    const cwd = cwdMap.get(ptyId);
    return collector.collect(cwd);
  });

  const pollingInterval = setInterval(async () => {
    const win = getWindow();
    // Guard: don't send while renderer is loading or crashed
    if (!win || win.isDestroyed() || win.webContents.isLoading()) return;

    for (const [ptyId] of cwdMap) {
      // ... existing polling logic unchanged
    }
  }, 5000);

  return () => {
    clearInterval(pollingInterval);
    ipcMain.removeHandler(IPC.METADATA_REQUEST);
  };
}

export function updateCwd(ptyId: string, cwd: string): void {
  cwdMap.set(ptyId, cwd);
}

export function removeCwd(ptyId: string): void {
  cwdMap.delete(ptyId);
}
```

- [ ] **Step 2: Verify — confirm interval is cleared on simulated crash recovery**

The verification is structural: Task 1's `cleanupHandlers()` now calls `cleanupMetadata()` which calls `clearInterval(pollingInterval)`. On re-registration, a new interval is created. No stacking.

Run: `npm start`, check console for `[MetadataCollector]` logs appearing at 5s intervals. Close DevTools and reopen — logs should continue at the same rate (not doubled).

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/handlers/metadata.handler.ts
git commit -m "fix(metadata): add isLoading guard and export removeCwd

- Skip metadata IPC sends while renderer is loading after crash
- Export removeCwd() for PTYBridge cleanup of stale entries
- removeHandler() before handle() for idempotent registration"
```

---

### Task 4: C4 — Save session before auto-update install

**Problem:** `autoUpdater.quitAndInstall()` kills the app immediately. The `before-quit` handler's session save is async/fire-and-forget — it doesn't complete before quit.

**Files:**
- Modify: `src/main/updater/AutoUpdater.ts`

- [ ] **Step 1: Add session save before `quitAndInstall` and cleanup listeners in `stop()`**

The session save uses the same `beforeunload` pattern already used in `index.ts` `before-quit` handler. No need for `sessionManager` import — just trigger the renderer's existing save mechanism and wait briefly for the IPC round-trip.

```typescript
// src/main/updater/AutoUpdater.ts — changes only

  stop(): void {
    if (this.checkTimer !== null) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    autoUpdater.removeAllListeners();  // prevent listener accumulation
    ipcMain.removeHandler(IPC.UPDATE_CHECK);
    ipcMain.removeHandler(IPC.UPDATE_INSTALL);
  }

  private registerIpcHandlers(): void {
    // ... existing UPDATE_CHECK handler ...

    ipcMain.handle(IPC.UPDATE_INSTALL, async () => {
      // Trigger session save via the existing beforeunload mechanism
      // (same pattern used in index.ts before-quit handler)
      const win = this.getWindow();
      if (win && !win.isDestroyed() && !win.webContents.isCrashed()) {
        try {
          await win.webContents.executeJavaScript(
            `try { window.dispatchEvent(new Event('beforeunload')); } catch(e) {}`
          );
          // Small delay to let the session:save IPC round-trip complete
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[AutoUpdater] Session save triggered before update install');
        } catch {
          console.warn('[AutoUpdater] Could not trigger session save before update');
        }
      }

      try {
        autoUpdater.quitAndInstall();
      } catch (err) {
        console.warn('[AutoUpdater] quitAndInstall error:', err);
      }
    });
  }
}
```

- [ ] **Step 2: Verify — check that UPDATE_INSTALL triggers session save**

Run: `npm start` — the auto-updater is no-op in dev (FEED_URL is empty), but verify no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/updater/AutoUpdater.ts
git commit -m "fix(updater): save session before quitAndInstall and cleanup listeners

- Trigger beforeunload event + 500ms wait before quitAndInstall()
- Call autoUpdater.removeAllListeners() in stop() to prevent accumulation"
```

---

### Task 5: C5 — Fix EADDRINUSE recovery with new server instance

**Problem:** On `EADDRINUSE`, the code calls `this.server.close()` then `this.server.listen()` on the same errored server object. After max retries, the pipe server dies silently — no notification to the user.

**Files:**
- Modify: `src/main/pipe/PipeServer.ts`

- [ ] **Step 1: Recreate server on EADDRINUSE and notify on failure**

Replace the `EADDRINUSE` error handler:

```typescript
// src/main/pipe/PipeServer.ts — replace the error handler in start()

this.server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    this.retryCount++;
    if (this.retryCount > PipeServer.MAX_RETRIES) {
      console.error(
        `[PipeServer] EADDRINUSE — exceeded max retries (${PipeServer.MAX_RETRIES}). Pipe server is dead.`,
      );
      this.server = null;
      return;
    }
    console.warn(
      `[PipeServer] EADDRINUSE — retry ${this.retryCount}/${PipeServer.MAX_RETRIES} in 1s...`,
    );
    setTimeout(() => {
      // Destroy the old server and create a fresh one
      if (this.server) {
        this.server.removeAllListeners();
        this.server.close();
      }
      this.server = null;
      // Recreate from scratch — errored server objects are not reliably reusable
      this.startInternal();
    }, 1000);
  } else {
    console.error('[PipeServer] Server error:', err);
  }
});
```

- [ ] **Step 2: Extract server creation into `startInternal()`**

Refactor `start()` into `start()` (public, one-time guard) and `startInternal()` (actual server creation):

```typescript
start(): void {
  if (this.server) return;
  this.retryCount = 0;
  this.startInternal();
}

private startInternal(): void {
  this.server = net.createServer((socket) => {
    this.connectedSockets.add(socket);
    socket.on('close', () => {
      this.connectedSockets.delete(socket);
      this.rateLimits.delete(socket);
    });
    this.handleConnection(socket);
  });

  this.server.maxConnections = PipeServer.MAX_CONNECTIONS;

  this.server.on('error', (err: NodeJS.ErrnoException) => {
    // ... EADDRINUSE handler from Step 1
  });

  const pipeName = getPipeName();
  if (process.platform !== 'win32') {
    try { require('fs').unlinkSync(pipeName); } catch {}
  }
  this.server.listen(pipeName, () => {
    console.log(`[PipeServer] Listening on ${pipeName}`);
    this.retryCount = 0;  // reset on success
  });
}
```

- [ ] **Step 3: Verify — start two instances (second should retry and fail gracefully)**

Run: `npm start` in one terminal.
Run: `npm start` in another terminal — it should fail with single-instance lock, but if you bypass that, the pipe server should log retries and eventually give up without crashing.

- [ ] **Step 4: Commit**

```bash
git add src/main/pipe/PipeServer.ts
git commit -m "fix(pipe): recreate server on EADDRINUSE instead of reusing errored instance

- Extract startInternal() for clean server recreation on retry
- Destroy old server and removeAllListeners before creating new one
- Reset retryCount on successful listen
- Log clearly when pipe server gives up (dead state)"
```

---

## Verification Checklist

After all 5 tasks are complete:

- [ ] `npm start` — app launches normally
- [ ] Open DevTools → Console → `while(true){}` → app auto-recovers after 10s
- [ ] Kill renderer process via Task Manager → app reloads, terminals reconnect
- [ ] Multiple crash/reload cycles → no "duplicate handler" errors, no doubled PTY writes
- [ ] Run for 1 hour → check Task Manager for memory growth (should be stable)
- [ ] Check console for metadata polling logs (should not show doubled interval)

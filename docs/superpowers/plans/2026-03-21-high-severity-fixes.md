# Phase 2: HIGH Severity Stability & Security Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 HIGH severity issues (H4 already fixed in Phase 1) that cause memory leaks, security gaps, and data loss in 24/7 operation.

**Architecture:** Independent fixes across main process files. Each task is self-contained and can be applied in any order. No new dependencies introduced.

**Tech Stack:** Electron (main process), Node.js, TypeScript

---

## File Map

| File | Changes |
|------|---------|
| `src/shared/constants.ts` | Per-user pipe name with username |
| `src/main/pipe/PipeServer.ts` | Use per-user pipe name |
| `src/main/mcp/McpRegistrar.ts` | Enforce Windows ACL on auth token file via icacls |
| `src/main/pty/PTYManager.ts` | Call bridge cleanup on dispose |
| `src/main/pty/PTYBridge.ts` | Use shared toastManager singleton; call removeCwd on cleanup; add idempotent guard |
| `src/main/session/SessionManager.ts` | Atomic backup (rename not copy); schema failure tries backup |
| `src/main/pipe/handlers/browser.rpc.ts` | Remove bypassable blocklist; add URL validation to browser.open |

---

### Task 1: H1+H2 — Per-user pipe name and auth token file ACL

**Problem:** Named pipe `\\.\pipe\wmux` is accessible to all local users. Auth token file `mode: 0o600` is ignored on Windows.

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/main/mcp/McpRegistrar.ts`

- [ ] **Step 1: Add username to pipe name in `constants.ts`**

Change `getPipeName()` to include the current username, preventing cross-user access:

```typescript
export function getPipeName(): string {
  if (process.platform === 'win32') {
    const username = process.env.USERNAME || 'default';
    return `\\\\.\\pipe\\wmux-${username}`;
  }
  // Unix: use user-specific path in home directory
  const home = process.env.HOME || '/tmp';
  return `${home}/.wmux.sock`;
}
```

This also moves the Unix socket from `/tmp/wmux.sock` (world-accessible) to `~/.wmux.sock` (user-owned home directory).

- [ ] **Step 2: Enforce Windows ACL on auth token file in `McpRegistrar.ts`**

After `writeFileSync`, call `icacls` to restrict to current user only:

```typescript
  register(authToken: string): void {
    try {
      fs.writeFileSync(this.authTokenPath, authToken, { encoding: 'utf8', mode: 0o600 });

      // On Windows, mode 0o600 is ignored. Use icacls to enforce owner-only access.
      if (process.platform === 'win32') {
        try {
          const { execFileSync } = require('child_process');
          // Remove inherited permissions, grant full control to current user only
          execFileSync('icacls', [this.authTokenPath, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`], { windowsHide: true });
        } catch (aclErr) {
          console.warn('[McpRegistrar] Could not set file ACL:', aclErr);
        }
      }

      console.log(`[McpRegistrar] Auth token written to ${this.authTokenPath}`);
      // ... rest unchanged
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/shared/constants.ts src/main/mcp/McpRegistrar.ts
git commit -m "fix(security): per-user pipe name and enforce auth token file ACL on Windows"
```

---

### Task 2: H3+H8 — PTY dispose calls bridge cleanup + cwdMap cleanup

**Problem:** `PTYManager.dispose()` deletes from its Map but doesn't call `PTYBridge.cleanupInstance()`. This leaks OscParser, AgentDetector, ActivityMonitor timer, and cwdMap entries per closed terminal.

**Files:**
- Modify: `src/main/pty/PTYManager.ts`
- Modify: `src/main/pty/PTYBridge.ts`

- [ ] **Step 1: Add bridge cleanup callback to PTYManager**

Add an optional `onDispose` callback that PTYBridge can register:

```typescript
// PTYManager.ts — add callback field and setter
export class PTYManager {
  private instances = new Map<string, PTYInstance>();
  private nextId = 0;
  private onDisposeCallback: ((ptyId: string) => void) | null = null;

  /** Register a callback invoked when dispose() is called, before the instance is removed. */
  onDispose(callback: (ptyId: string) => void): void {
    this.onDisposeCallback = callback;
  }

  // In dispose():
  dispose(id: string): void {
    const instance = this.instances.get(id);
    if (instance) {
      try { instance.process.kill(); } catch { /* already dead */ }
      this.onDisposeCallback?.(id);
      this.instances.delete(id);
    }
  }
```

- [ ] **Step 2: Register bridge cleanup in PTYBridge constructor + add removeCwd + idempotent guard**

```typescript
// PTYBridge.ts
import { removeCwd } from '../ipc/handlers/metadata.handler';

export class PTYBridge {
  // ... existing fields ...

  constructor(
    private ptyManager: PTYManager,
    private getWindow: () => BrowserWindow | null,
  ) {
    // Register cleanup callback so dispose() triggers bridge cleanup
    this.ptyManager.onDispose((ptyId) => this.cleanupInstance(ptyId));

    // ... existing activityMonitor.onActiveToIdle ...
  }

  cleanupInstance(ptyId: string): void {
    this.oscParsers.delete(ptyId);
    this.agentDetectors.delete(ptyId);
    this.ptyCreatedAt.delete(ptyId);
    this.activityMonitor.stop(ptyId);
    removeCwd(ptyId);  // H8: clear stale cwdMap entry
    this.ptyManager.remove(ptyId);
  }

  setupDataForwarding(ptyId: string): void {
    // Idempotent guard: prevent duplicate onData listeners
    if (this.oscParsers.has(ptyId)) {
      console.warn(`[PTYBridge] setupDataForwarding already active for ${ptyId} — skipping`);
      return;
    }
    // ... rest unchanged
  }
```

- [ ] **Step 3: Use shared toastManager singleton (H7)**

```typescript
// PTYBridge.ts — change line 13
// BEFORE:
private toastManager = new ToastManager();

// AFTER:
import { toastManager } from '../pipe/handlers/notify.rpc';
// Remove the import of ToastManager class and the private field
// Use toastManager directly (it's the module-level singleton)
```

Remove `import { ToastManager } from '../notification/ToastManager';` and `private toastManager = new ToastManager();`. Replace all `this.toastManager` references with just `toastManager`.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/main/pty/PTYManager.ts src/main/pty/PTYBridge.ts
git commit -m "fix(pty): dispose calls bridge cleanup, use shared ToastManager, clear cwdMap"
```

---

### Task 3: H5+H6 — Atomic session backup + schema failure tries backup

**Problem:** `copyFileSync` for backup is not atomic — power loss corrupts both files. Schema validation failure returns null without trying backup.

**Files:**
- Modify: `src/main/session/SessionManager.ts`

- [ ] **Step 1: Replace `copyFileSync` with `renameSync` in `save()`**

Both files are on the same filesystem (userData), so `renameSync` is atomic:

```typescript
  save(data: SessionData): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const json = JSON.stringify(data, null, 2);

      // 1. Write to temporary file
      fs.writeFileSync(this.tmpPath, json, 'utf-8');

      // 2. Atomic backup: rename existing session → .bak (not copy — atomic on same FS)
      if (fs.existsSync(this.filePath)) {
        try {
          fs.renameSync(this.filePath, this.bakPath);
        } catch (bakErr) {
          console.warn('[SessionManager] Failed to create backup:', bakErr);
        }
      }

      // 3. Atomic rename: tmp → session.json
      fs.renameSync(this.tmpPath, this.filePath);
    } catch (err) {
      // ... existing error handling unchanged
    }
  }
```

- [ ] **Step 2: Schema validation failure tries backup in `load()`**

Extract a helper `validateSession` to DRY the validation, then add backup fallback after schema failure:

```typescript
  private validateSession(parsed: unknown): SessionData | null {
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>)['workspaces']) ||
      typeof (parsed as Record<string, unknown>)['activeWorkspaceId'] !== 'string'
    ) {
      return null;
    }
    return parsed as SessionData;
  }

  private parseSessionFile(filePath: string): SessionData | null {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
      return value;
    });
    return this.validateSession(parsed);
  }

  load(): SessionData | null {
    // Try primary file
    try {
      const result = this.parseSessionFile(this.filePath);
      if (result) return result;
    } catch (err) {
      console.error('[SessionManager] Failed to load primary session:', err);
    }

    // Primary missing, empty, corrupt, or failed schema — try backup
    try {
      console.warn('[SessionManager] Trying backup...');
      const result = this.parseSessionFile(this.bakPath);
      if (result) {
        console.warn('[SessionManager] Recovered session from backup.');
        return result;
      }
    } catch (bakErr) {
      console.error('[SessionManager] Backup recovery also failed:', bakErr);
    }

    return null;
  }
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/main/session/SessionManager.ts
git commit -m "fix(session): atomic backup with renameSync, schema failure tries backup"
```

---

### Task 4: H9+H10 — Fix browser.eval blocklist and browser.open URL validation

**Problem:** `browser.eval` blocklist is trivially bypassable with string concatenation. `browser.open` has no URL scheme validation at all (navigate does).

**Files:**
- Modify: `src/main/pipe/handlers/browser.rpc.ts`

- [ ] **Step 1: Remove the bypassable blocklist from `browser.eval`, add defense-in-depth comment**

The webview sandbox (`contextIsolation: true`, `sandbox: true`) is the actual security boundary. The regex blocklist gives false confidence and is trivially bypassed. Replace it with a clear comment:

```typescript
  router.register('browser.eval', (params) => {
    if (typeof params['code'] !== 'string' || params['code'].length === 0) {
      throw new Error('browser.eval: missing required param "code"');
    }
    // Security note: code runs inside the webview's sandboxed renderer.
    // contextIsolation: true and sandbox: true prevent access to Node.js APIs.
    // The webview sandbox is the security boundary, not a regex blocklist
    // (which is trivially bypassable via string concatenation).
    const code = params['code'];
    const surfaceId = typeof params['surfaceId'] === 'string' ? params['surfaceId'] : undefined;
    return sendToRenderer(getWindow, 'browser.eval', {
      code,
      ...(surfaceId && { surfaceId }),
    });
  });
```

- [ ] **Step 2: Add URL scheme validation to `browser.open`**

Extract a shared URL validation function and apply to both `browser.open` and `browser.navigate`:

```typescript
// At the top of the file, after imports:
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'];

function validateUrl(url: string, method: string): void {
  const normalized = url.trim().toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (normalized.startsWith(scheme)) {
      throw new Error(`${method}: blocked URL scheme`);
    }
  }
}

// In browser.open handler:
router.register('browser.open', (params) => {
  const url = typeof params['url'] === 'string' ? params['url'] : undefined;
  if (url) validateUrl(url, 'browser.open');
  return sendToRenderer(getWindow, 'browser.open', {
    ...(url && { url }),
  });
});

// In browser.navigate handler — replace inline check:
router.register('browser.navigate', (params) => {
  if (typeof params['url'] !== 'string' || params['url'].length === 0) {
    throw new Error('browser.navigate: missing required param "url"');
  }
  validateUrl(params['url'], 'browser.navigate');
  // ... rest unchanged (remove the old inline normalizedUrl check)
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/main/pipe/handlers/browser.rpc.ts
git commit -m "fix(security): remove bypassable eval blocklist, add URL validation to browser.open"
```

---

## Verification Checklist

After all 4 tasks:

- [ ] `npx tsc --noEmit` — no new type errors
- [ ] `npm start` — app launches normally
- [ ] Pipe connects on per-user name (check `\\.\pipe\wmux-<username>`)
- [ ] Open/close terminals repeatedly → no memory growth in Task Manager
- [ ] Auth token file has restricted ACL: `icacls %USERPROFILE%\.wmux-auth-token`

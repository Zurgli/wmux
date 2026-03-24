## v1.1.2 — Terminal Scrollback Persistence

### New Features

**Terminal Session Restore**
- Terminal scrollback content is now saved to disk automatically (every 5 seconds + on app exit)
- On restart, previous terminal output is fully restored with a `--- session restored ---` separator
- Workspace layout, tabs, and working directory are preserved across restarts
- PowerShell startup clear-screen is suppressed during restore to keep previous content visible

**Daemon Session Infrastructure**
- Added `suspended` session state for future daemon-level session recovery
- Scrollback buffer dump/load via `RingBuffer.dumpToFile()` / `RingBuffer.loadFromFile()`
- `StateWriter` buffer path management (`getBufferDumpPath`, `ensureBufferDir`, `cleanOrphanedBuffers`)
- `DaemonSessionManager.createSession()` now accepts `scrollbackData` and `createdAt` for recovery
- Graceful shutdown dumps all live session buffers before disposing PTYs

### Bug Fixes

- **Windows process detection**: Replaced unreliable `process.kill(pid, 0)` with `tasklist.exe` for accurate stale PID detection
- **Named pipe recovery**: Added retry with fallback names when Windows zombie pipe handles block `EADDRINUSE`/`EACCES`
- **Daemon auth verification**: `daemon.ping` check before committing to daemon mode prevents `unauthorized` errors
- **Frozen store objects**: Scrollback dump now clones Zustand store surfaces instead of mutating frozen objects
- **Viewport padding**: `serializeTerminalBuffer()` only captures content up to cursor position, eliminating empty line bloat

### Technical Details

- Scrollback files stored at `{userData}/scrollback/{surfaceId}.txt`
- IPC channels: `scrollback:dump`, `scrollback:load` with surfaceId validation (path traversal prevention)
- 5MB cap per scrollback dump to prevent disk bloat
- Scrollback files are one-time use (deleted after successful restore)
- `terminalRegistry` (Map<ptyId, Terminal>) enables buffer access from save logic
- Prompt detection (`PS X:\`, `>`, `$`) determines when to stop suppressing shell startup output

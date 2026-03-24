# wmux

**AI Agent Terminal for Windows**

Run Claude Code, Codex, Gemini CLI side by side — with built-in browser automation, smart notifications, and MCP integration.

Inspired by [cmux](https://github.com/manaflow-ai/cmux) (macOS), wmux brings the same philosophy to Windows: **a primitive, not a solution.** Composable building blocks for multi-agent workflows.

![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows)
![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron)
![npm](https://img.shields.io/npm/v/@wong2kim/wmux?color=CB3837&logo=npm)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Install

**Download:** [wmux-2.0.0 Setup.exe](https://github.com/openwong2kim/wmux/releases/latest)

Or build from source:
```powershell
irm https://raw.githubusercontent.com/openwong2kim/wmux/main/install.ps1 | iex
```

**npm (CLI + MCP server only):**
```bash
npm install -g @wong2kim/wmux
```

---

## What's New in v2.0.0

- **Browser automation via CDP** — Click, fill, type, screenshot directly through Chrome DevTools Protocol. Works with React inputs, CJK text, and controlled components.
- **Security hardening** — Token auth on all pipes, SSRF protection, input sanitization, randomized CDP ports, memory pressure watchdog.
- **Workspace reset** — One-click reset in Settings to clean all workspaces and start fresh.
- **Daemon process** — Background session management with suspend/resume, scrollback persistence, and auto-recovery.

---

## Why wmux?

| Problem | wmux |
|---------|------|
| Windows has no cmux | Native Windows terminal multiplexer for AI agents |
| Agents can't control the browser | Built-in browser with CDP — Claude clicks, fills, types, screenshots |
| "Is it done yet?" | Smart activity-based notifications + taskbar flash |
| Can't compare agents | Multiview — Ctrl+click workspaces to view side by side |
| Hard to describe UI elements to LLM | Inspector — click any element, LLM-friendly context copied |

---

## Features

### Terminal
- **xterm.js + WebGL** GPU-accelerated rendering
- **ConPTY** native Windows pseudo-terminal
- **Split panes** — `Ctrl+D` horizontal, `Ctrl+Shift+D` vertical
- **Tabs** — multiple surfaces per pane
- **Vi copy mode** — `Ctrl+Shift+X`
- **Search** — `Ctrl+F`
- **Unlimited scrollback** — 999,999 lines default
- **Scrollback persistence** — terminal content saved to disk, restored on restart

### Workspaces
- Sidebar with drag-and-drop reordering
- `Ctrl+1` ~ `Ctrl+9` quick switch
- **Multiview** — `Ctrl+click` workspaces to split-view them simultaneously
- **Session persistence** — workspace layout, tabs, cwd, and terminal scrollback all restored on restart
- **One-click reset** — Settings > General > Reset to clean all workspaces

### Browser + CDP Automation
- Built-in browser panel — `Ctrl+Shift+L`
- Navigation bar, DevTools, back/forward
- **Element Inspector** — hover to highlight, click to copy LLM-friendly context
- **Full CDP automation via MCP:**
  - Click elements by ref or CSS selector
  - Fill forms with real keyboard input (handles React, CJK)
  - Take screenshots via CDP `Page.captureScreenshot`
  - Evaluate JavaScript with user gesture context
  - Navigate, go back, press keys

### Notifications
- **Activity-based detection** — monitors output throughput, no fragile pattern matching
- **Taskbar flash** — orange flash when notifications arrive while unfocused
- **Windows toast** — native OS notification with click-to-focus
- **Process exit alerts** — notifies on non-zero exit codes
- **Notification panel** — `Ctrl+I`, read/unread tracking, per-workspace filtering
- **Sound** — Web Audio synthesized tones per notification type

### MCP Server (Claude Code Integration)
wmux automatically registers its MCP server when launched. Claude Code can:

| Tool | What it does |
|------|-------------|
| `browser_open` | Open a new browser panel |
| `browser_navigate` | Go to URL |
| `browser_screenshot` | Capture page as PNG (CDP) |
| `browser_snapshot` | Get page structure with interactive element refs |
| `browser_click` | Click element by ref number |
| `browser_fill` | Fill form fields by ref |
| `browser_type` | Type text into element (CDP keyboard input) |
| `browser_press_key` | Press keyboard key (Enter, Tab, etc.) |
| `browser_evaluate` | Execute JavaScript in page context |
| `browser_hover` | Hover over element |
| `browser_select` | Select dropdown options |
| `browser_scroll_into_view` | Scroll element into viewport |
| `terminal_read` | Read terminal screen |
| `terminal_send` | Send text to terminal |
| `terminal_send_key` | Send key (enter, ctrl+c, etc.) |
| `workspace_list` | List all workspaces |
| `surface_list` | List surfaces |
| `pane_list` | List panes |

**Multi-agent:** All browser tools accept `surfaceId` — each Claude Code session controls its own browser independently.

### Security
- **Token authentication** on all IPC pipes (named pipe + session pipes)
- **SSRF protection** — URL validation blocks private IPs, file://, javascript: schemes
- **Input sanitization** — PTY command injection prevention
- **CDP port randomization** — no fixed debug port
- **Memory pressure watchdog** — auto-reaps dead sessions at 750MB, blocks new at 1GB
- **Electron Fuses** — RunAsNode disabled, cookie encryption enabled

### Agent Status Detection
Gate-based detection for AI coding agents:
- Claude Code, Cursor, Aider, Codex CLI, Gemini CLI, OpenCode, GitHub Copilot CLI
- Detects agent startup, monitors activity
- Critical action warnings (git push --force, rm -rf, DROP TABLE, etc.)

### Daemon Process
- Background session management (survives app restart)
- Suspend/resume with scrollback buffer dump
- Auto-recovery of sessions on daemon restart
- Dead session TTL reaping (24h default)

### Themes
Catppuccin, Tokyo Night, Dracula, Nord, Gruvbox, Solarized, One Dark, and more.

### i18n
English, 한국어, 日本語, 中文

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+D` | Split right |
| `Ctrl+Shift+D` | Split down |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+N` | New workspace |
| `Ctrl+1~9` | Switch workspace |
| `Ctrl+click` | Add workspace to multiview |
| `Ctrl+Shift+G` | Exit multiview |
| `Ctrl+Shift+L` | Open browser |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+K` | Command palette |
| `Ctrl+I` | Notifications |
| `Ctrl+,` | Settings |
| `Ctrl+F` | Search terminal |
| `Ctrl+Shift+X` | Vi copy mode |
| `Ctrl+Shift+H` | Flash pane |
| `Alt+Ctrl+Arrow` | Focus adjacent pane |
| `F12` | Browser DevTools |

---

## CLI

```bash
wmux workspace list
wmux workspace create "backend"
wmux pane split-right
wmux pane send-text "npm test"
wmux notify --title "Done" --body "Tests passed"
wmux browser snapshot
wmux browser click "#submit-btn"
```

---

## Development

```bash
git clone https://github.com/openwong2kim/wmux.git
cd wmux
npm install
npm start           # Dev mode
npm run make        # Build installer
```

### Requirements (development only)
- Node.js 18+
- Python 3.x (for node-gyp)
- Visual Studio Build Tools with C++ workload

The `install.ps1` script auto-installs Python and VS Build Tools if missing.

---

## Architecture

```
Electron Main Process
├── PTYManager (node-pty / ConPTY)
├── PTYBridge (data forwarding + ActivityMonitor)
├── AgentDetector (gate-based agent status)
├── SessionManager (atomic save with .bak recovery)
├── ScrollbackPersistence (dump/load terminal buffers)
├── PipeServer (Named Pipe JSON-RPC + token auth)
├── McpRegistrar (auto-registers MCP in ~/.claude.json)
├── WebviewCdpManager (CDP proxy to <webview> via debugger)
├── DaemonClient (optional daemon mode connector)
└── ToastManager (OS notifications + taskbar flash)

Renderer Process (React 19 + Zustand)
├── PaneContainer (recursive split layout)
├── Terminal (xterm.js + WebGL + scrollback restore)
├── BrowserPanel (webview + Inspector + CDP)
├── NotificationPanel
├── SettingsPanel (workspace reset)
└── Multiview grid

Daemon Process (optional, standalone)
├── DaemonSessionManager (ConPTY lifecycle)
├── RingBuffer (circular scrollback buffer)
├── StateWriter (session suspend/resume)
├── ProcessMonitor (external process watchdog)
├── Watchdog (memory pressure escalation)
└── DaemonPipeServer (Named Pipe RPC + token auth)

MCP Server (stdio)
├── PlaywrightEngine (CDP connection, fast-fail)
├── CDP RPC fallback (browser.screenshot, browser.evaluate, etc.)
└── Bridges Claude Code <-> wmux via Named Pipe RPC
```

---

## Acknowledgments

- [cmux](https://github.com/manaflow-ai/cmux) — The macOS AI agent terminal that inspired wmux
- [xterm.js](https://xtermjs.org/) — Terminal rendering
- [node-pty](https://github.com/microsoft/node-pty) — Pseudo-terminal
- [Electron](https://www.electronjs.org/) — Desktop framework
- [Playwright](https://playwright.dev/) — Browser automation engine

---

## Note on AI Agents

wmux detects AI coding agents for status display purposes only. It does not call any AI APIs, capture agent outputs, or automate agent interactions. Users are responsible for complying with their AI provider's Terms of Service.

## License

MIT

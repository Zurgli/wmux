# wmux MCP Server

MCP server that lets Claude Code control wmux's browser and terminal.
Supports multi-agent use — each agent can target its own browser via `surfaceId`.

## Setup

1. Build the MCP server:
   ```bash
   npm run build:mcp
   ```

2. Add to your project's `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "wmux": {
         "command": "node",
         "args": ["<path-to-wmux>/dist/mcp/mcp/index.js"]
       }
     }
   }
   ```

   `WMUX_SOCKET_PATH` and `WMUX_AUTH_TOKEN` are automatically set in wmux
   terminal sessions. When running Claude Code inside wmux, no extra env
   config is needed.

## Available Tools

| Tool | Description |
|------|-------------|
| `browser_open` | 브라우저에 URL 열기 |
| `browser_navigate` | URL 이동 |
| `browser_close` | 브라우저 패널 닫기 |
| `browser_session_start` | 브라우저 세션 시작 |
| `browser_session_stop` | 브라우저 세션 중지 |
| `browser_session_status` | 세션 상태 조회 |
| `browser_session_list` | 프로필 목록 |
| `browser_type_humanlike` | Human-like 타이핑 |
| `terminal_read` | Read terminal screen |
| `terminal_send` | Send text to terminal |
| `terminal_send_key` | Send key (enter, ctrl+c, etc.) |
| `workspace_list` | List workspaces |
| `surface_list` | List surfaces (terminals + browsers) |
| `pane_list` | List panes |

## Multi-Agent Usage

All browser tools accept an optional `surfaceId` parameter. Use `surface_list`
to discover available surfaces, then pass the browser surface's ID:

```
1. Call surface_list → find your browser surface ID
2. Call browser_navigate with surfaceId="<your-browser-id>"
3. Call browser_snapshot with surfaceId="<your-browser-id>"
```

When `surfaceId` is omitted, the currently active browser surface is used.

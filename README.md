# wmux — AI Agent Terminal for Windows

> **Claude Code + Codex + Gemini CLI, 한 화면에서 동시에.**
> 터미널 분할, 브라우저 자동화, MCP 통합 — Windows에서 AI 에이전트를 제대로 쓰는 유일한 방법.

[![Windows 10/11](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows&logoColor=white)](https://github.com/openwong2kim/wmux/releases/latest)
[![npm](https://img.shields.io/npm/v/@wong2kim/wmux?color=CB3837&logo=npm)](https://www.npmjs.com/package/@wong2kim/wmux)
[![Electron 41](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/openwong2kim/wmux?style=social)](https://github.com/openwong2kim/wmux)

---

## Windows에서 AI 코딩 에이전트, 아직도 터미널 하나로 쓰세요?

macOS에는 [cmux](https://github.com/manaflow-ai/cmux)가 있습니다. tmux 위에서 여러 AI 에이전트를 동시에 돌리는 도구죠.

**Windows에는 tmux가 없습니다.** WSL 없이는 방법이 없었습니다.

wmux는 이 문제를 해결합니다. Windows 네이티브 터미널 멀티플렉서 + 브라우저 자동화 + MCP 서버. AI 에이전트가 터미널도 읽고, 브라우저도 조작하고, 알아서 일합니다.

```
Claude Code가 왼쪽에서 백엔드를 짜는 동안
Codex가 오른쪽에서 프론트엔드를 짜고
Gemini CLI가 아래에서 테스트를 돌립니다
— 전부 한 화면에서, 동시에.
```

---

## 30초 설치

**설치 파일:**

[wmux-2.0.0 Setup.exe 다운로드](https://github.com/openwong2kim/wmux/releases/latest)

**원라인 설치 (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/openwong2kim/wmux/main/install.ps1 | iex
```

**npm (CLI + MCP 서버):**
```bash
npm install -g @wong2kim/wmux
```

---

## 왜 wmux인가?

### 1. AI 에이전트가 브라우저를 직접 조작합니다

Claude Code에게 "구글에서 검색해봐"라고 하면, 진짜로 합니다.

wmux의 내장 브라우저는 Chrome DevTools Protocol로 연결됩니다. 클릭, 입력, 스크린샷, JS 실행 — 전부 AI가 직접 합니다. React 컨트롤드 인풋도, 한글 입력도 완벽하게 동작합니다.

```
You: "리즈포토부스 검색해줘"
Claude: browser_open → browser_snapshot → browser_fill(ref=13, "리즈포토부스") → browser_press_key("Enter")
→ 실제로 Google에서 검색 완료
```

### 2. 터미널 여러 개를 하나의 화면에서

`Ctrl+D`로 분할, `Ctrl+N`으로 워크스페이스 추가. 각 워크스페이스에 여러 터미널과 브라우저를 배치하고, `Ctrl+click`으로 멀티뷰 — 여러 워크스페이스를 동시에 봅니다.

ConPTY 기반 네이티브 Windows 터미널. xterm.js + WebGL 하드웨어 가속 렌더링. 스크롤백 99만줄. 세션 종료해도 터미널 내용이 보존됩니다.

### 3. "다 됐어?" 안 물어봐도 됩니다

AI 에이전트가 끝나면 wmux가 알아서 알려줍니다.

- 작업 완료 → 데스크톱 알림 + 작업표시줄 깜빡임
- 비정상 종료 → 즉시 경고
- `git push --force`, `rm -rf`, `DROP TABLE` → 위험 동작 감지

패턴 매칭이 아니라 출력 처리량 기반 감지. 어떤 에이전트든 동작합니다.

### 4. Claude Code와 자동 연동

wmux를 실행하면 MCP 서버가 자동 등록됩니다. Claude Code가 바로 사용 가능:

| Claude가 할 수 있는 것 | MCP 도구 |
|---|---|
| 브라우저 열기 | `browser_open` |
| URL 이동 | `browser_navigate` |
| 스크린샷 찍기 | `browser_screenshot` |
| 페이지 구조 읽기 | `browser_snapshot` |
| 요소 클릭 | `browser_click` |
| 폼 입력 | `browser_fill` / `browser_type` |
| JS 실행 | `browser_evaluate` |
| 키 입력 | `browser_press_key` |
| 터미널 읽기 | `terminal_read` |
| 터미널에 명령 보내기 | `terminal_send` |
| 워크스페이스 관리 | `workspace_list` / `surface_list` / `pane_list` |

**멀티 에이전트:** 모든 브라우저 도구는 `surfaceId`를 지원합니다. 각 Claude Code 세션이 독립적으로 자기 브라우저를 조작합니다.

### 5. 보안을 신경 씁니다

- 모든 IPC 파이프에 토큰 인증
- SSRF 차단 — 내부 IP, `file://`, `javascript:` 스킴 차단
- PTY 입력 새니타이징 — 커맨드 인젝션 방지
- CDP 포트 랜덤화
- 메모리 압력 워치독 — 750MB에서 세션 정리, 1GB에서 새 세션 차단
- Electron Fuses — RunAsNode 비활성화

---

## 전체 기능

### 터미널
- xterm.js + WebGL GPU 가속 렌더링
- ConPTY 네이티브 Windows 의사 터미널
- 분할 — `Ctrl+D` 가로, `Ctrl+Shift+D` 세로
- 탭 — 창마다 여러 surface
- Vi 복사 모드 — `Ctrl+Shift+X`
- 검색 — `Ctrl+F`
- 스크롤백 99만줄, 디스크 저장/복원

### 워크스페이스
- 사이드바 드래그 앤 드롭 정렬
- `Ctrl+1~9` 빠른 전환
- 멀티뷰 — `Ctrl+click`으로 동시 보기
- 세션 영속성 — 레이아웃, 탭, cwd, 스크롤백 전부 복원
- 설정에서 원클릭 초기화

### 브라우저 + CDP 자동화
- 내장 브라우저 — `Ctrl+Shift+L`
- 네비게이션 바, DevTools, 뒤로/앞으로
- 엘리먼트 인스펙터 — 호버하면 하이라이트, 클릭하면 LLM 친화 컨텍스트 복사
- CDP 기반 자동화 (클릭, 입력, 스크린샷, JS 실행, 키 입력)

### 알림
- 출력량 기반 활동 감지
- 작업표시줄 깜빡임 + Windows 토스트 알림
- 프로세스 종료 경고
- 알림 패널 — `Ctrl+I`
- Web Audio 사운드

### 에이전트 감지
Claude Code, Cursor, Aider, Codex CLI, Gemini CLI, OpenCode, GitHub Copilot CLI
- 시작 감지 → 모니터링 활성화
- 위험 동작 경고

### 데몬 프로세스
- 백그라운드 세션 관리 (앱 재시작에도 생존)
- 스크롤백 버퍼 덤프/복구
- Dead 세션 TTL 자동 정리 (24시간)

### 테마
Catppuccin, Tokyo Night, Dracula, Nord, Gruvbox, Solarized, One Dark 등

### 다국어
English, 한국어, 日本語, 中文

---

## 단축키

| 키 | 동작 |
|-----|------|
| `Ctrl+D` | 오른쪽 분할 |
| `Ctrl+Shift+D` | 아래로 분할 |
| `Ctrl+T` | 새 탭 |
| `Ctrl+W` | 탭 닫기 |
| `Ctrl+N` | 새 워크스페이스 |
| `Ctrl+1~9` | 워크스페이스 전환 |
| `Ctrl+click` | 멀티뷰 추가 |
| `Ctrl+Shift+G` | 멀티뷰 종료 |
| `Ctrl+Shift+L` | 브라우저 열기 |
| `Ctrl+B` | 사이드바 전환 |
| `Ctrl+K` | 명령 팔레트 |
| `Ctrl+I` | 알림 |
| `Ctrl+,` | 설정 |
| `Ctrl+F` | 터미널 검색 |
| `Ctrl+Shift+X` | Vi 복사 모드 |
| `F12` | 브라우저 DevTools |

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

## 개발

```bash
git clone https://github.com/openwong2kim/wmux.git
cd wmux
npm install
npm start           # 개발 모드
npm run make        # 인스톨러 빌드
```

### 개발 요구사항
- Node.js 18+
- Python 3.x (node-gyp용)
- Visual Studio Build Tools + C++ 워크로드

`install.ps1`이 Python과 VS Build Tools를 자동 설치합니다.

---

## 아키텍처

```
Electron Main Process
├── PTYManager (node-pty / ConPTY)
├── PTYBridge (데이터 포워딩 + ActivityMonitor)
├── AgentDetector (게이트 기반 에이전트 상태)
├── SessionManager (원자적 저장 + .bak 복구)
├── ScrollbackPersistence (터미널 버퍼 덤프/로드)
├── PipeServer (Named Pipe JSON-RPC + 토큰 인증)
├── McpRegistrar (~/.claude.json 자동 등록)
├── WebviewCdpManager (CDP 프록시 → <webview>)
├── DaemonClient (데몬 모드 커넥터)
└── ToastManager (OS 알림 + 작업표시줄 깜빡임)

Renderer Process (React 19 + Zustand)
├── PaneContainer (재귀적 분할 레이아웃)
├── Terminal (xterm.js + WebGL + 스크롤백 복원)
├── BrowserPanel (webview + Inspector + CDP)
├── NotificationPanel
├── SettingsPanel (워크스페이스 초기화)
└── Multiview 그리드

Daemon Process (독립 실행)
├── DaemonSessionManager (ConPTY 수명주기)
├── RingBuffer (순환 스크롤백 버퍼)
├── StateWriter (세션 중단/재개)
├── ProcessMonitor (외부 프로세스 워치독)
├── Watchdog (메모리 압력 에스컬레이션)
└── DaemonPipeServer (Named Pipe RPC + 토큰 인증)

MCP Server (stdio)
├── PlaywrightEngine (CDP 연결, 빠른 실패)
├── CDP RPC 폴백 (screenshot, evaluate, type, click)
└── Claude Code <-> wmux Named Pipe RPC 브릿지
```

---

## 감사

- [cmux](https://github.com/manaflow-ai/cmux) — wmux의 영감이 된 macOS AI 에이전트 터미널
- [xterm.js](https://xtermjs.org/) — 터미널 렌더링
- [node-pty](https://github.com/microsoft/node-pty) — 의사 터미널
- [Electron](https://www.electronjs.org/) — 데스크톱 프레임워크
- [Playwright](https://playwright.dev/) — 브라우저 자동화

---

## AI 에이전트 관련 안내

wmux는 AI 코딩 에이전트를 상태 표시 목적으로만 감지합니다. AI API를 호출하거나, 에이전트 출력을 캡처하거나, 에이전트 동작을 자동화하지 않습니다. 사용자는 각 AI 제공자의 서비스 약관을 준수할 책임이 있습니다.

## 라이선스

MIT

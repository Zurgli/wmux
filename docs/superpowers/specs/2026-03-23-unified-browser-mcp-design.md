# Unified Browser MCP Design

**Date:** 2026-03-23
**Status:** Draft → Reviewed
**Goal:** wmux MCP에 Playwright를 내장하여 단일 MCP로 OpenClaw 수준의 브라우저 제어 능력을 제공

## 1. 배경 및 동기

### 현재 문제
- MCP 서버 3개 (wmux, wmux-playwright, wmux-devtools)가 분리되어 AI가 도구 선택에 혼란
- wmux-devtools는 별도 외부 창을 띄워 내부 webview와 무관하게 동작
- wmux-playwright는 CDP endpoint로 연결 가능하나 별도 MCP 서버로 분리되어 있음
- 브라우저 관련 도구가 3개 MCP에 분산되어 일관성 없음

### 목표
- **단일 wmux MCP**에 Playwright 내장 → 브라우저 도구 제공
- 외부 창 없이 **내부 webview**에서 모든 자동화 수행
- OpenClaw 수준의 브라우저 제어 + anti-detection 기법 적용
- 용도: 로컬호스트 디버깅, 스레드 자동화, 업무 자동화

## 2. 제거 항목

| 항목 | 조치 |
|------|------|
| `wmux-devtools` MCP | McpRegistrar에서 등록 코드 삭제, `.claude.json`에서 제거 |
| `wmux-playwright` MCP | McpRegistrar에서 등록 코드 삭제, `.claude.json`에서 제거 |
| `browser_cdp_target` 도구 | 외부 노출 제거, 내부 RPC로 유지 (PlaywrightEngine이 사용) |
| `browser_type_humanlike` 도구 | `browser_type`에 `humanlike` 옵션으로 통합 |

## 3. 아키텍처

### 프로세스 구조

```
┌─────────────────────────────────────────────┐
│ Electron Main Process                       │
│  ├── WebviewCdpManager (CDP 타겟 관리)      │
│  ├── PipeServer (RPC 서버)                  │
│  │   └── browser.cdp.info RPC (신규)        │
│  └── CDP port 18800 (remote-debugging-port) │
└─────────────────────────────────────────────┘
        │ named pipe (\\.\pipe\wmux)
        │
┌─────────────────────────────────────────────┐
│ wmux MCP Process (별도 Node.js 프로세스)    │
│  ├── MCP SDK Server                         │
│  ├── RPC Client → pipe로 Main Process 호출  │
│  └── PlaywrightEngine                       │
│      └── chromium.connectOverCDP()          │
│          → http://localhost:18800           │
└─────────────────────────────────────────────┘
```

### CDP 포트 디스커버리

MCP 프로세스는 Main Process의 CDP 포트를 알아야 한다.

**방법:** MCP 프로세스 시작 시 `browser.cdp.info` RPC를 호출하여 포트와 타겟 목록을 수신.

```typescript
// 신규 RPC: browser.cdp.info
// Main Process에서 구현
{
  method: 'browser.cdp.info',
  result: {
    cdpPort: 18800,
    targets: CdpTargetInfo[]  // surfaceId, targetId, wsUrl
  }
}
```

PlaywrightEngine은 이 정보로 초기화되며, 이후 `browser_open` 호출 시 새 타겟이 등록되면 RPC로 갱신.

### 연결 흐름

```
1. MCP 프로세스 시작
   → browser.cdp.info RPC로 cdpPort 획득
   → PlaywrightEngine.connect(cdpPort)
   → chromium.connectOverCDP(`http://localhost:${cdpPort}`)

2. AI가 browser_open 호출
   → wmux RPC → renderer가 webview surface 생성
   → WebviewCdpManager가 CDP 타겟 등록
   → PlaywrightEngine이 browser.pages()로 새 페이지 감지

3. AI가 browser_snapshot 등 Playwright 도구 호출
   → PlaywrightEngine.getPage(surfaceId?)로 대상 페이지 획득
   → Playwright API로 조작
   → 결과 반환
```

### 핵심 컴포넌트

#### PlaywrightEngine (`src/mcp/playwright/PlaywrightEngine.ts`)

```typescript
class PlaywrightEngine {
  private browser: Browser | null = null;
  private cdpEndpoint: string;

  constructor(cdpPort: number) {
    this.cdpEndpoint = `http://localhost:${cdpPort}`;
  }

  // CDP endpoint로 Electron에 연결
  async connect(): Promise<void>;

  // 연결 해제 (graceful shutdown)
  async disconnect(): Promise<void>;

  // 연결 상태 확인 + 자동 재연결
  async ensureConnected(): Promise<void>;

  // surfaceId로 페이지 찾기 (targetId 매칭, 캐시하지 않음)
  // 매 호출마다 browser.pages()에서 fresh하게 조회
  async getPage(surfaceId?: string): Promise<Page>;
}
```

**페이지 매칭 전략:**
- `browser.cdp.info` RPC로 `surfaceId → targetId` 매핑 획득
- `browser.pages()`에서 targetId로 매칭 (URL 매칭은 불안정하므로 사용하지 않음)
- Page 객체는 캐시하지 않음 — 매 도구 호출마다 fresh하게 조회
- surfaceId 생략 시 첫 번째(또는 유일한) 페이지 반환

#### 도구 등록 (`src/mcp/playwright/tools/`)

```
src/mcp/playwright/
├── PlaywrightEngine.ts
├── tools/
│   ├── navigation.ts        # navigate, navigate_back, tabs
│   ├── interaction.ts       # click, type, fill, press_key, hover, drag, select, scroll_into_view
│   ├── inspection.ts        # snapshot, screenshot, evaluate, console, errors, network, response_body, highlight
│   ├── state.ts             # cookies, storage, emulation (통합), resize
│   ├── file.ts              # file_upload, download, wait_for_download, dialog
│   ├── wait.ts              # wait
│   └── utility.ts           # pdf, trace_start, trace_stop
├── anti-detection.ts        # userGesture 설정 등
├── snapshot.ts              # 접근성 스냅샷 생성/파싱/truncation
└── human-typing.ts          # 타이핑 딜레이 로직 (MCP 프로세스 내 독립 구현)
```

## 4. 도구 목록

### 도구 수 최적화

리뷰 피드백을 반영하여 도구를 통합:
- `browser_set_*` 7개 → `browser_emulate` 1개로 통합 (discriminated union)
- `browser_tab_*` 3개 → `browser_tabs` 1개로 통합 (action 파라미터)
- `browser_console` + `browser_errors` → `browser_console` 1개로 통합
- `browser_trace_start/stop` → `browser_trace` 1개로 통합

기존 terminal(3) + workspace(3) 도구와 합쳐 **총 38개**.

### Surface 관리 (2개)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_open` | webview surface 생성 | `url?`, `surfaceId?` |
| `browser_close` | webview surface 제거 | `surfaceId?` |

### 네비게이션 (3개)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_navigate` | URL 이동 | `url`, `surfaceId?` |
| `browser_navigate_back` | 뒤로 가기 | `surfaceId?` |
| `browser_tabs` | 탭 목록/생성/전환/닫기 | `action?` (list/new/select/close), `tabId?`, `url?` |

### 인터랙션 (10개)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_click` | 요소 클릭 | `ref`, `double?`, `surfaceId?` |
| `browser_type` | 텍스트 입력 | `ref`, `text`, `submit?`, `humanlike?`, `surfaceId?` |
| `browser_fill` | 폼 일괄 채우기 | `fields` (JSON), `surfaceId?` |
| `browser_press_key` | 키보드 입력 | `key`, `surfaceId?` |
| `browser_hover` | 요소 호버 | `ref`, `surfaceId?` |
| `browser_drag` | 드래그 앤 드롭 | `sourceRef`, `targetRef`, `surfaceId?` |
| `browser_select` | 드롭다운 선택 | `ref`, `values`, `surfaceId?` |
| `browser_scroll_into_view` | 요소 스크롤 | `ref`, `surfaceId?` |
| `browser_file_upload` | 파일 업로드 | `paths`, `ref?`, `surfaceId?` |
| `browser_dialog` | 다이얼로그 처리 | `accept`, `text?`, `surfaceId?` |

### 인스펙션 (7개)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_snapshot` | 접근성 트리 스냅샷 | `format?` (ai/aria), `ref?`, `surfaceId?` |
| `browser_screenshot` | 스크린샷 캡처 | `fullPage?`, `ref?`, `surfaceId?` |
| `browser_evaluate` | JavaScript 실행 | `expression`, `surfaceId?` (userGesture 기본 true) |
| `browser_console` | 콘솔/에러 조회 | `level?` (error/warn/info/all), `clear?`, `surfaceId?` |
| `browser_network` | 네트워크 요청 조회 | `filter?`, `surfaceId?` |
| `browser_response_body` | 응답 본문 추출 | `urlPattern`, `surfaceId?` |
| `browser_highlight` | 요소 하이라이트 | `ref`, `surfaceId?` |

### 상태 관리 (5개)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_cookies` | 쿠키 관리 | `action` (get/set/clear), `url?`, `surfaceId?` |
| `browser_storage` | 스토리지 관리 | `type` (local/session), `action` (get/set/clear), `surfaceId?` |
| `browser_emulate` | 환경 에뮬레이션 (통합) | `offline?`, `headers?`, `credentials?`, `geo?`, `media?`, `timezone?`, `locale?`, `device?`, `surfaceId?` |
| `browser_resize` | 뷰포트 크기 변경 | `width`, `height`, `surfaceId?` |

### 대기 (1개)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_wait` | 조건 대기 | `url?`, `selector?`, `text?`, `fn?`, `timeout?`, `surfaceId?` |

### 유틸리티 (2개)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_pdf` | PDF 내보내기 | `path?`, `surfaceId?` |
| `browser_trace` | 트레이스 녹화 | `action` (start/stop), `path?` |

### 세션 (4개, 기존 유지)
| 도구 | 설명 | 핵심 파라미터 |
|------|------|---------------|
| `browser_session_start` | 세션 시작 | `profile` |
| `browser_session_stop` | 세션 중지 | - |
| `browser_session_status` | 세션 상태 조회 | - |
| `browser_session_list` | 프로필 목록 | - |

**브라우저 도구 합계: 34개** + terminal 3 + workspace 3 = **총 40개 도구**

### Snapshot 포맷 및 크기 제한

접근성 스냅샷은 복잡한 페이지에서 수천 노드가 될 수 있음.

- **기본 포맷:** `ai` — ref 속성 포함, 인터랙티브 요소 위주로 필터링
- **크기 제한:** 최대 50,000자. 초과 시 비인터랙티브 요소 제거 후 재생성
- **ref 주입:** 각 인터랙티브 요소에 `ref="N"` 부여, 후속 `browser_click(ref)` 등에서 사용
- **depth 제한:** 기본 깊이 10단계, `depth` 파라미터로 조절 가능

## 5. Anti-Detection 기법 (OpenClaw 참고)

### 적용할 기법

1. **CDP 직접 연결** (이미 적용)
   - `chromium.connectOverCDP()`로 Electron에 연결
   - 자동화 프로토콜 대신 CDP 사용으로 `navigator.webdriver` 시그널 최소화

2. **userGesture: true** (신규)
   - `browser_evaluate` 도구에서 JS 실행 시 `userGesture: true` 플래그
   - CDP `Runtime.evaluate`에 직접 전달
   - 사용자 상호작용으로 인식시켜 일부 봇 탐지 우회

3. **환경 에뮬레이션** (신규, `browser_emulate` 도구)
   - timezone, locale, geolocation, device, user-agent, HTTP headers
   - 하나의 도구에서 필요한 항목만 선택적으로 설정

4. **HumanBehavior** (MCP 프로세스 내 독립 구현)
   - `browser_type`의 `humanlike: true` 옵션
   - MCP 프로세스 내에서 Playwright `page.keyboard.press()`를 50-150ms 랜덤 딜레이로 호출
   - Main Process의 `HumanBehavior.ts`와 무관 (tsconfig 경계 존중)

### 적용하지 않는 기법
- **프로필 Decoration** — Electron 내부 webview는 독립 프로필 디렉토리가 없으므로 불필요
- Canvas/WebGL 핑거프린트 랜덤화 — 과도한 복잡성
- stealth 플러그인 — Electron 내부 webview에서 불필요
- navigator.webdriver 패치 — CDP 직접 연결로 충분

## 6. McpRegistrar 변경

```typescript
// Before: 3개 MCP 등록
this.registerInClaudeJson('wmux', wmuxEntry);
this.registerInClaudeJson('wmux-playwright', playwrightEntry);
this.registerInClaudeJson('wmux-devtools', devtoolsEntry);

// After: 1개 MCP만 등록
this.registerInClaudeJson('wmux', wmuxEntry);
// playwright, devtools 등록 코드 삭제

// Cleanup: 기존 키 제거
this.removeFromClaudeJson('wmux-playwright');
this.removeFromClaudeJson('wmux-devtools');
```

## 7. 의존성 변경

### 추가
- `playwright-core` — Playwright 라이브러리 (브라우저 번들 없이 코어만)

### 빌드

esbuild에서 `playwright-core`를 external로 처리:

```bash
esbuild dist/mcp/mcp/index.js --bundle --platform=node \
  --outfile=dist/mcp-bundle/index.js \
  --external:electron \
  --external:playwright-core
```

프로덕션 배포 시 `playwright-core`를 `resources/node_modules/`에 포함하거나 Electron Forge의 `extraResources`로 번들.

## 8. 파일 구조

### 신규 파일
```
src/mcp/playwright/
├── PlaywrightEngine.ts          # 코어 엔진 (연결, 페이지 조회, 재연결)
├── tools/
│   ├── navigation.ts            # navigate, navigate_back, tabs
│   ├── interaction.ts           # click, type, fill, press_key, hover, drag, select, scroll_into_view, file_upload, dialog
│   ├── inspection.ts            # snapshot, screenshot, evaluate, console, network, response_body, highlight
│   ├── state.ts                 # cookies, storage, emulate, resize
│   ├── wait.ts                  # wait
│   └── utility.ts              # pdf, trace
├── anti-detection.ts            # userGesture 설정
├── snapshot.ts                  # 접근성 스냅샷 생성/파싱/truncation
└── human-typing.ts              # 타이핑 딜레이 로직 (독립 구현)
```

### 수정 파일
```
src/mcp/index.ts               # Playwright 도구 등록, 기존 browser 도구 교체
src/main/mcp/McpRegistrar.ts   # playwright/devtools 등록 제거, cleanup 추가
src/main/pipe/handlers/browser.rpc.ts  # browser.cdp.info RPC 추가
package.json                   # playwright-core 의존성 추가, build:mcp 스크립트 수정
tsconfig.mcp.json              # src/mcp/playwright/ 포함 확인
```

## 9. 에러 처리

- **연결 실패:** 자동 재연결 3회, 1초 간격. 3회 실패 시 에러 반환
- **webview 없음:** "browser_open을 먼저 호출하세요" 에러 메시지
- **CDP 타겟 미발견:** `browser.cdp.info` RPC로 5초 대기 후 재조회
- **네비게이션 중 호출:** Playwright가 자동으로 대기
- **장시간 대기 중 연결 끊김:** try/catch로 MCP 구조화된 에러 반환 (프로세스 크래시 방지)
- **surfaceId 미매칭:** 존재하지 않는 surfaceId 요청 시 사용 가능한 surface 목록과 함께 에러 반환

## 10. Graceful Shutdown

MCP 프로세스 종료 시 Playwright 연결을 정리:

```typescript
process.on('SIGTERM', async () => {
  await playwrightEngine.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await playwrightEngine.disconnect();
  process.exit(0);
});

// MCP SDK server close 이벤트
server.onClose(async () => {
  await playwrightEngine.disconnect();
});
```

CDP 디버거 세션이 정리되지 않으면 다음 연결에 영향을 줄 수 있으므로 반드시 disconnect 호출.

## 11. 테스트 전략

- **PlaywrightEngine 단위 테스트:** mock CDP 서버로 연결/재연결/에러 시나리오
- **도구 카테고리별 단위 테스트:** 각 도구의 파라미터 검증, 에러 처리
- **McpRegistrar 테스트:** 단일 MCP만 등록, cleanup 동작 확인
- **통합 테스트:** browser_open → browser_navigate → browser_snapshot → browser_click 흐름
- **CI 환경:** Electron 없이 mock CDP 서버로 테스트 가능하도록 PlaywrightEngine에 DI 지원
- **스냅샷 크기 테스트:** 복잡한 페이지에서 truncation이 정상 동작하는지 확인
- **에러 경로 테스트:** CDP 포트 불가, webview 크래시, 연결 끊김 시나리오

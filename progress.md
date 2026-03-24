# Progress — Security Hardening Round 2

## Summary
- Phase: 3 (구현)
- Done: 0/4 | In Progress: 0 | Waiting: 4 | Blocked: 0

## DAG (전체 병렬 — 파일 겹침 없음)
- G-A (CDP 보안 + 디버그 로그 제거): []
- G-B (FS 경로 제한 + 워치 제한): []
- G-C (browser_evaluate 제한): []
- G-D (Watchdog 에스컬레이션): []

## Groups

### G-A: CDP 포트 랜덤화 + wsUrl 비노출 + 디버그 로그 제거 (T4+T14)
- **Status**: waiting
- **Files**: src/main/index.ts, src/main/browser-session/WebviewCdpManager.ts, src/main/pipe/handlers/browser.rpc.ts

### G-B: FS 경로 제한 + 워치 개수 제한 (T7+T12)
- **Status**: waiting
- **Files**: src/main/ipc/handlers/fs.handler.ts

### G-C: browser_evaluate/wait 위험 패턴 경고 (T11)
- **Status**: waiting
- **Files**: src/mcp/playwright/tools/inspection.ts, src/mcp/playwright/tools/wait.ts

### G-D: Watchdog 에스컬레이션 (T13)
- **Status**: waiting
- **Files**: src/daemon/Watchdog.ts, src/daemon/index.ts

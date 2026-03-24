# Decisions Log — Security Hardening Round 2

## DEC-001: T4 CDP 보안 — 포트 랜덤화 + wsUrl 비노출
- **Date**: 2026-03-24
- **Context**: CDP를 완전 비활성화하면 PlaywrightEngine(connectOverCDP) + WebviewCdpManager 전부 사용 불가
- **Decision**: CDP 완전 비활성화 대신 (1) 포트 랜덤화 (18800-18899 범위), (2) browser.cdp.info/target에서 raw wsUrl 제거, (3) 하드코딩 디버그 로그 경로 제거 (T14 포함)
- **Rationale**: PlaywrightEngine.connect()와 WebviewCdpManager 모두 CDP 포트 필요. 포트 고정(18800)이 문제지 CDP 자체가 문제가 아님

## DEC-002: T7 FS 경로 제한 — 민감 경로 차단 (blocklist)
- **Date**: 2026-03-24
- **Context**: fs.handler.ts가 모든 경로 읽기 허용
- **Decision**: 민감 경로 차단 방식. ~/.ssh, ~/.aws, ~/.gnupg, 인증서/토큰 파일 차단. 나머지 허용
- **Rationale**: 터미널 앱은 다양한 경로 접근이 필요. 차단 목록이 더 현실적

## DEC-003: T11 browser_evaluate 제한 — 위험 패턴 경고 + 감사 로그
- **Date**: 2026-03-24
- **Context**: browser_evaluate 완전 차단하면 MCP 브라우저 자동화 핵심 기능 상실
- **Decision**: 위험 패턴 감지 시 경고 반환 + 실행은 허용하되 로그 기록. browser_wait fn도 동일
- **Rationale**: 에이전트가 의도적으로 쓸 수 있어야 하지만, 프롬프트 인젝션 방어로 경고 제공

## DEC-004: 범위 — 4개 병렬 그룹
- **Date**: 2026-03-24
- **Decision**: G-A(T4+T14), G-B(T7+T12), G-C(T11), G-D(T13) 전부 병렬

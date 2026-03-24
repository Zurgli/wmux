# Decisions Log

## DEC-001: Daemon 구현 언어 — Node.js first, Rust later
- **Date**: 2026-03-24
- **Context**: daemon을 Rust로 새로 짤지, Node.js로 기존 코드를 재사용할지
- **Options**: (A) Node.js only, (B) Rust only, (C) Node.js → Rust 전환
- **Decision**: (C) Node.js로 MVP, IPC 프로토콜을 언어 중립적으로 설계하여 추후 Rust 전환 가능
- **Rationale**: 기존 PTYManager/PipeServer/SessionManager 80% 재사용. 빠른 검증 후 필요시 daemon만 교체

## DEC-002: 구현 범위 — Phase 2a + 2b (수정)
- **Date**: 2026-03-24
- **Context**: 이번 팀모드에서 어디까지 구현할지
- **Options**: (A) 2a만, (B) 2a+2b, (C) 2a+2b+2c
- **Decision**: (B) 2a+2b. architect-review에서 범위 과다 FAIL 판정. 다중 UI/Windows 서비스/시스템 트레이는 다음 Phase로 분리
- **Rationale**: 2a만으로도 8개+ 모듈. 핵심 영속성 + 안정성까지 확보하고 편의 기능은 이후 진행

## DEC-003: Electron UI 통합 — 프록시 전환
- **Date**: 2026-03-24
- **Context**: daemon 도입 시 기존 Electron PTY 코드 처리 방법
- **Options**: (A) pty.handler.ts가 daemon으로 프록시, (B) renderer가 daemon에 직접 연결
- **Decision**: (A) 프록시 전환. main의 handler가 daemon 클라이언트 역할
- **Rationale**: renderer/store 코드 변경 없음. 리스크 최소화. main의 PTY handler만 교체

## DEC-004: PTYBridge 파싱 로직 — daemon에서 실행
- **Date**: 2026-03-24
- **Context**: OscParser/AgentDetector/ActivityMonitor를 daemon에 둘지 Electron에 남길지
- **Options**: (A) daemon에서 파싱 → Control Pipe 이벤트 전달, (B) Electron에서 파싱 → daemon은 raw만
- **Decision**: (A) daemon에서 파싱
- **Rationale**: detach 중에도 에이전트 상태 추적 필요. sessions.json에 의미있는 상태 기록. 깔끔한 책임 분리

## DEC-005: 기존 PipeServer와의 관계 — 별도 운영
- **Date**: 2026-03-24
- **Context**: daemon 도입 후 기존 CLI/MCP용 PipeServer를 어떻게 할지
- **Options**: (A) daemon이 흡수, (B) 기존 유지 + daemon 파이프 별도
- **Decision**: (B) 별도 운영. Electron은 기존 PipeServer(\\.\pipe\wmux-{user}) 유지, daemon은 \\.\pipe\wmux-daemon-{user}
- **Rationale**: 기존 CLI/MCP 기능에 영향 없음. daemon은 PTY 영속성에만 집중. 관심사 분리

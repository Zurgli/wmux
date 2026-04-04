# Contributing to wmux

Thanks for your interest in contributing to wmux! Here's how to get started.

## Getting Started

```bash
git clone https://github.com/openwong2kim/wmux.git
cd wmux
npm install
npm run start   # dev mode
npm test        # run tests
```

Requires Node.js 22+ and Windows 10/11 (ConPTY).

## Pull Requests

### One PR, One Purpose

Keep PRs focused on a single concern. Don't mix unrelated changes.

- **Security fix** → security PR only
- **New feature** → feature PR only
- **Bug fix** → bug fix PR only

If your work touches multiple areas, split it into separate PRs.

### Fork And Upstream Branch Strategy

If a change needs to go to both your fork and the upstream repository, use two branches instead of trying to reuse one branch for both targets.

- Create an `-upstream` branch from `upstream/main` that contains only the change intended for the upstream PR.
- Create a `-fork` branch from your local `main` branch, then cherry-pick the same feature commit onto it for the fork PR.
- Open the fork PR from the `-fork` branch and the upstream PR from the `-upstream` branch.

This avoids pulling fork-only commits into upstream review and avoids pulling upstream-only cleanup into fork integration.

### PR Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] New code has tests
- [ ] Commit messages are clear and descriptive

### Commit Style

```
<type>: <short description>

fix: resolve zombie pipe cleanup on daemon restart
feat: add split pane keyboard shortcuts
security: harden filesystem bridge path resolution
refactor: extract token writer to shared module
test: add SSRF validation coverage for IPv6-mapped IPv4
docs: update CLI reference for org commands
```

## Reporting Security Issues

If you find a security vulnerability, please **do not open a public issue**. Instead, email [open.wong2kim@gmail.com] or open a draft security advisory on GitHub. We'll respond within 48 hours.

## Code Style

- TypeScript strict mode
- Vitest for testing
- No `any` unless absolutely necessary — explain why in a comment

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

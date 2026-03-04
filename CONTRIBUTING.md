# Contributing Guide

Thank you for your interest in contributing to `bluente-translate-mcp-server`.

## Development Setup

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Copy environment template:

```bash
cp .env.example .env
```

4. Set your test credentials in `.env`:

- `BLUENTE_API_KEY`
- `BLUENTE_API_BASE_URL` (optional, defaults to current API version)
- `BLUENTE_API_TIMEOUT_MS` (optional)

## Project Conventions

- Keep comments and docs in English.
- Keep tool modules focused and single-purpose.
- Add new tool schemas in `src/tools/schemas.js`.
- Register tools via `src/tools/register-tools.js`.
- Reuse shared error/result helpers in `src/lib/`.

## Quality Checks

Run checks before opening a PR:

```bash
npm run check
```

If you add behavior that touches API flows, include a short manual validation note in the PR description.

## Commit and PR Guidance

- Use clear commit messages in imperative mood.
- Keep PRs small and scoped.
- Include:
  - Summary of change
  - Why the change is needed
  - Risk/rollback notes
  - Validation evidence

## Reporting Issues

Please include:

- Repro steps
- Expected vs actual result
- Environment (Node version, MCP client)
- Relevant logs (remove secrets)

## Security

Do not include API keys, tokens, or private files in issues/PRs.
See `SECURITY.md` for disclosure instructions.

# Contributing Guide

Thank you for your interest in contributing to `bluente-translate-mcp-server`.

## Development Setup

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Set your test credentials in the environment (the server never reads a `.env`
   file; MCP hosts pass variables through their config's `env` block, and for a
   terminal run export them or prefix the command). See `.env.example` for names:

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

## Releasing

Publishing to npm is done by CI, not from a laptop:

1. Bump `version` in `package.json` (and `src/server.js`), update `CHANGELOG.md`, merge to `main`.
2. Tag the merge commit and push the tag: `git tag v1.2.3 && git push origin v1.2.3`.
3. `.github/workflows/release.yml` runs `npm ci`, `npm test`, then
   `npm publish --provenance` via npm trusted publishing (GitHub OIDC). No npm
   token is stored in the repository.

One-time setup by an npm maintainer: on npmjs.com, open the package's
Settings → Trusted publishers and add this repository with workflow file
`release.yml`. Until that exists the publish step fails with a 404/403.

## Reporting Issues

Please include:

- Repro steps
- Expected vs actual result
- Environment (Node version, MCP client)
- Relevant logs (remove secrets)

## Security

Do not include API keys, tokens, or private files in issues/PRs.
See `SECURITY.md` for disclosure instructions.

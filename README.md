<div align="center">

<a href="https://www.bluente.com/" target="_blank" rel="noopener noreferrer">
  <img src="https://translate.bluente.com/_next/static/media/singleLogo.c3edb4ba.svg" alt="Bluente Logo" width="72" height="72" />
</a>

# Bluente Translate MCP Server

**AI-powered. Format-preserving. Built for professional document translation workflows.**

[![CI](https://img.shields.io/github/actions/workflow/status/bluente/bluente-translate-mcp-server/ci.yml?branch=main&label=CI)](./.github/workflows/ci.yml)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![MCP](https://img.shields.io/badge/protocol-MCP-111111)](https://modelcontextprotocol.io/)

</div>

`bluente-translate-mcp-server` is the official open-source MCP server for exposing Bluente translation capabilities to AI clients.

It wraps Bluente APIs into production-ready MCP tools so teams can automate multilingual document workflows from Claude Desktop, Cursor, and other MCP-compatible runtimes.

## Why Bluente

Bluente focuses on enterprise-grade document translation where **accuracy, formatting integrity, and speed** matter.

From [Bluente.com](https://www.bluente.com/) and [Blu Translate](https://www.bluente.com/translator), the core product positioning is:

- AI-powered translation for professional use cases
- Original layout retention for document-centric workflows
- Broad language and file-type support
- Security-first handling for sensitive content

This MCP server brings those capabilities into agent workflows through a standard protocol interface.

## Brand Identity

This repository is maintained by **Bluente** and is part of Bluente's public developer ecosystem.

- Company website: [https://www.bluente.com](https://www.bluente.com)
- Product page: [https://www.bluente.com/translator](https://www.bluente.com/translator)
- API docs: [https://www.bluente.com/docs](https://www.bluente.com/docs)

## Table of Contents

- [What You Get](#what-you-get)
- [Architecture](#architecture)
- [Supported Bluente APIs](#supported-bluente-apis)
- [MCP Tools](#mcp-tools)
- [Quick Start](#quick-start)
- [Local Development](#local-development)
- [Operational Notes](#operational-notes)
- [Data Handling & Privacy](#data-handling--privacy)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing and Governance](#contributing-and-governance)
- [License](#license)

## What You Get

- Modular Node.js MCP server with clear layering (`config`, `client`, `service`, `tools`)
- One-file-per-tool implementation for maintainability
- Unified tool response envelope (`ok/tool/data` and structured errors)
- End-to-end translation workflow tool (upload -> start -> poll -> download)
- CI checks and local smoke tests

## Architecture

```text
AI Client (Claude / Cursor / Agents)
            |
            | MCP (stdio)
            v
+---------------------------------------+
| Bluente Translate MCP Server          |
|                                       |
|  tools/  -> MCP tool handlers         |
|  services/ -> workflow orchestration  |
|  clients/ -> Bluente HTTP API client  |
|  config/ + lib/ -> env/errors/results |
+---------------------------------------+
            |
            | HTTPS
            v
      Bluente Translation APIs
```

Project layout:

```text
src/
  clients/bluente-http-client.js
  config/env.js
  constants/api.js
  lib/errors.js
  lib/mcp-result.js
  services/translation-workflow-service.js
  tools/*.tool.js
  tools/schemas.js
  tools/register-tools.js
  server.js
  index.js
tests/smoke/core-smoke.test.js
```

## Supported Bluente APIs

- `GET /blu_translate/supported_languages`
- `POST /blu_translate/upload`
- `GET /blu_translate/check`
- `POST /blu_translate/translate`
- `GET /blu_translate/download`

Reference: [Bluente API Docs](https://www.bluente.com/docs)

## MCP Tools

- `bluente_get_supported_languages`
- `bluente_upload_file`
- `bluente_get_translation_status`
- `bluente_translate_file`
- `bluente_download_file`
- `bluente_translate_document_workflow`

These match the tools exposed by Bluente's hosted MCP server, so a prompt or
agent written against one works against the other. The differences are the two
things only a local server can do: `file_path` as a source, and `output_path`
for saving results to disk (the hosted server hands out download links instead).

Tool behavior notes:

- **Confirmation gate**: `bluente_translate_document_workflow` is a two-call flow. The first call uploads the file and returns `page_count` plus a confirmation card for the user; **nothing starts and no credits are deducted**. Call again with the returned `task_id`, `confirmed=true`, and explicit `to`, `to_type`, and `bilingual` values to actually start. `bluente_translate_file` has no gate and starts immediately.
- **File sources**: `file_path` (a file on this machine), `file_url` (a public link), or `file_content_base64` (under 2MB).
- `bluente_translate_file`: `from` and `to` are required when `action="start"` and optional when `action="cancel"`.
- **`to_type`**: `pdf`, `word`, or `pptx`. The workflow tool also accepts an array (e.g. `["word", "pdf"]`) — extra formats are download-time conversions of the same translation and cost no extra credits.
- **`entry` / `status_entry`**: `get_status` (translation progress, the default) or `get_page_count` (the uploaded file's page count).
- **Language codes**: Bluente uses nonstandard codes (`zh`, `cht`, `jp`, `kor`, `fra`, `spa`, ...). Common ISO spellings (`zh-CN`, `zh-TW`, `ja`, `ko`, `fr`, `es`) are auto-aliased; call `bluente_get_supported_languages` for the full list.
- **`bilingual`**: `on` keeps the original text alongside the translation; `off` (default) produces a clean translated document. When `on`, set **`bilingual_layout`** to `left-right` (side by side) or `top-down` (stacked) — these are the only two layouts Bluente supports. The numeric `vertical_bilingual` flag is a deprecated alias.
- **`mode`**: `standard` (most digital documents), `scanned (text)` (OCR a scan into a clean text-only document), `scanned (overlay)` (place the translation back over the original scanned layout), or `image` (re-render a graphic like a brochure or poster in the target language; 5 credits per page — the only mode charged above the standard rate, scanned modes cost the same as standard). The numeric `scanned` 0–3 flag is a deprecated alias.
- **`page_range`** (e.g. `"1-3,5"`): translate only selected pages; credits are charged only for those pages.
- **Glossary**: the workflow tool always translates with the glossary enabled (matching the Bluente web product); its `glossary`/`custom_glossary` arguments are deprecated and ignored. On the raw `bluente_translate_file` tool the backend applies the glossary only when *both* `glossary` and `custom_glossary` are `1`.

Success envelope:

```json
{
  "ok": true,
  "tool": "bluente_upload_file",
  "data": {
    "code": 0,
    "message": "success",
    "data": { "id": "task_xxx" }
  }
}
```

Error envelope:

```json
{
  "isError": true,
  "ok": false,
  "tool": "bluente_translate_file",
  "error": {
    "name": "BluenteApiError",
    "message": "Bluente API request failed.",
    "details": { "status": 401 }
  }
}
```

## Quick Start

Requirements: Node.js `>= 20` (check with `node --version`; install from [nodejs.org](https://nodejs.org)) and a Bluente API key.

**Getting an API key:** log in at [translate.bluente.com](https://translate.bluente.com) and go to **My Files → API Keys and Webhook**. Treat the key like a password — it authorizes translations billed to your account, so keep it out of version control and shared documents.

### Option 1: Just let your coding agent do it

The fastest way to install: don't. If you use Claude Code, Cursor, or any MCP-capable coding agent, paste this prompt and watch it handle everything — config file, key, verification — in under a minute. Replace `YOUR_KEY_HERE` with your API key:

> Install the Bluente Translate MCP server into this client. It's the npm package `@bluente/translate-mcp-server`, run via `npx -y @bluente/translate-mcp-server` (stdio), and it needs the environment variable `BLUENTE_API_KEY` set in the server config's `env` block. Use `YOUR_KEY_HERE` as the key. After configuring, verify the installation by calling the `bluente_get_supported_languages` tool and show me the result. Docs: https://github.com/Bluente/bluente-translate-mcp-server

The agent finds the right config file for its client, writes the block, and proves the install works by showing you the supported-language list.

Prefer not to paste your API key into an agent conversation? Have the agent use `REPLACE_ME` as the key, then edit the config file by hand and restart your client.

### Option 2: Install manually

**Claude Desktop**

1. Open **Settings → Developer → Edit Config** (opens `claude_desktop_config.json`).
2. Add this block (merge into `mcpServers` if it already exists), inserting your API key:

   ```json
   {
     "mcpServers": {
       "bluente-translate": {
         "command": "npx",
         "args": ["-y", "@bluente/translate-mcp-server"],
         "env": {
           "BLUENTE_API_KEY": "your_api_key_here"
         }
       }
     }
   }
   ```

3. Quit and reopen Claude Desktop. The tools icon should list six `bluente_*` tools.

**Claude Code** — one command, then restart your session and verify with `/mcp`:

```bash
claude mcp add bluente-translate -e BLUENTE_API_KEY=your_api_key_here -- npx -y @bluente/translate-mcp-server
```

**Cursor** — Settings → MCP → Add server, or create `.cursor/mcp.json` in your project with the same JSON block as Claude Desktop.

**Smoke test (any client):** ask *"What languages does Bluente translation support?"* — a free, read-only call. A language list back means the key and connection both work. The first run takes a few extra seconds while `npx` downloads the package.

### Troubleshooting the API key

The server reads `BLUENTE_API_KEY` from its environment — you never pass it as a tool argument or store it in a file. If the server reports `Missing BLUENTE_API_KEY`, the key is not reaching the server process: check the `env` block for typos and restart your client. When testing from a terminal, prefix the server command itself (`BLUENTE_API_KEY=your_api_key_here npx -y @bluente/translate-mcp-server`); in a shell pipeline the assignment must sit directly before `npx` — placed at the start of the line it applies only to the first command in the pipe.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BLUENTE_API_KEY` | (required) | Your Bluente API key |
| `BLUENTE_API_BASE_URL` | `https://api.bluente.com/api/20250924` | API base URL |
| `BLUENTE_API_TIMEOUT_MS` | `90000` | HTTP timeout in milliseconds |
| `BLUENTE_OUTPUT_DIR` | `~/Downloads/bluente` | Where downloads are saved when no `output_path` is given |

## Local Development

```bash
git clone https://github.com/bluente/bluente-translate-mcp-server.git
cd bluente-translate-mcp-server
npm install
BLUENTE_API_KEY=... npm start   # run the server on stdio (no .env file is read)
npm run check          # syntax check
npm test               # run tests
```

To point an MCP client at your local checkout, use `"command": "node"` with `"args": ["/absolute/path/to/bluente-translate-mcp-server/src/index.js"]` instead of the `npx` config above.

## Operational Notes

- The workflow tool returns as soon as translation starts. Poll `bluente_get_translation_status` until `READY`, then call `bluente_download_file`.
- `auto_download=true` instead blocks until the translation finishes and saves the file(s) to disk. Only safe for small documents — translation often takes minutes and your MCP client may time the request out first.
- `max_poll_attempts` is a single budget shared across the upload and translation phases.
- Timeout is configurable via `BLUENTE_API_TIMEOUT_MS`.
- For production, use separate API keys per environment.

## Data Handling & Privacy

- **Documents you translate are uploaded to Bluente's API** (`api.bluente.com` by default) for processing. Do not translate documents you are not permitted to send to a third-party service.
- **The AI model controls the tools.** When run locally (stdio), `file_path` lets the model read any file your user account can read and upload it to Bluente, and `output_path` lets it write downloaded files to any writable path (existing files are never overwritten; without `output_path` files go to `BLUENTE_OUTPUT_DIR` or `~/Downloads/bluente`, and the server-supplied file name is reduced to a bare basename). Review tool calls in your MCP client before approving them, especially when working with untrusted documents — a malicious document could try to instruct the model to misuse these tools.
- Translated output returned by tools (file contents, status payloads) enters your AI client's context and is therefore visible to your LLM provider.
- Your API key stays on your machine: it is read from the environment and sent only as an `Authorization` header to the configured Bluente API base URL. It is never logged or included in tool responses. The server never reads a `.env` file from the working directory (a workspace opened in your editor cannot redirect the key), `BLUENTE_API_BASE_URL` must be `https://`, and a non-`bluente.com` host is flagged with a warning at startup.

## Security

- Do not commit API keys or `.env` files.
- Rotate leaked keys immediately.
- Use repository private vulnerability reporting.

See [SECURITY.md](./SECURITY.md) for disclosure policy.

## Roadmap

- Add text translation tools if exposed in public API docs
- Add richer integration tests with API mocking
- Add container image and one-command local launch profile

## Contributing and Governance

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Code ownership: [.github/CODEOWNERS](./.github/CODEOWNERS)

## About Bluente

Bluente builds AI translation and business communication solutions for professional teams.

- Website: [bluente.com](https://www.bluente.com/)
- Product page: [Blu Translate](https://www.bluente.com/translator)
- API documentation: [bluente.com/docs](https://www.bluente.com/docs)

## License

MIT

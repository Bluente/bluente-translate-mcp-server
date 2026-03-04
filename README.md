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
- [MCP Client Integration](#mcp-client-integration)
- [Operational Notes](#operational-notes)
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
- `POST /blu_translate/upload_file`
- `GET /blu_translate/get_translation_status`
- `POST /blu_translate/translate_file`
- `GET /blu_translate/download_file`

Reference: [Bluente API Docs](https://www.bluente.com/docs)

## MCP Tools

- `bluente_get_supported_languages`
- `bluente_upload_file`
- `bluente_get_translation_status`
- `bluente_translate_file`
- `bluente_download_file`
- `bluente_translate_document_workflow`

Tool behavior notes:

- `bluente_translate_file`: `from` and `to` are required when `action="start"` and optional when `action="cancel"`.
- `bluente_translate_document_workflow`: `status_entry` is configurable (`pdf` or `word`) for status polling.

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

### 1. Requirements

- Node.js `>= 20`
- Bluente API key

### 2. Install

```bash
npm install
cp .env.example .env
```

### 3. Configure

```env
BLUENTE_API_KEY=your_api_key_here
BLUENTE_API_BASE_URL=https://api.bluente.com/api/20250924
BLUENTE_API_TIMEOUT_MS=90000
```

### 4. Run

```bash
npm start
```

### 5. Validate locally

```bash
npm run check
npm test
```

## MCP Client Integration

Example for Claude Desktop:

```json
{
  "mcpServers": {
    "bluente-translate": {
      "command": "node",
      "args": ["/absolute/path/to/bluente-translate-mcp-server/src/index.js"],
      "env": {
        "BLUENTE_API_KEY": "your_api_key_here",
        "BLUENTE_API_BASE_URL": "https://api.bluente.com/api/20250924",
        "BLUENTE_API_TIMEOUT_MS": "90000"
      }
    }
  }
}
```

## Operational Notes

- Workflow tool polls until terminal state (`READY` or `ERROR`).
- Output download can be disabled with `auto_download=false`.
- Timeout is configurable via `BLUENTE_API_TIMEOUT_MS`.
- For production, use separate API keys per environment.

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

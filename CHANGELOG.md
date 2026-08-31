# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [0.4.0] - 2026-08-29

Aligns this server's tool interface with Bluente's hosted MCP server, so a prompt
or agent written against one works against the other. The only intended
differences are the two things a local server can do that a hosted one cannot:
`file_path` as a file source, and saving results to disk.

### Added

- **Confirmation gate on `bluente_translate_document_workflow`.** It is now a two-call flow: the first call uploads the file and returns `page_count` plus a confirmation card the model must show the user verbatim; nothing starts and no credits are deducted until a second call passes the returned `task_id` with `confirmed=true` and explicit `to`, `to_type`, and `bilingual` values. `task_id` is required for a confirmed call, so no first call can start a translation. `page_range` is validated against the real page count before the card quotes a cost.
- **`bilingual_layout`** (`left-right` or `top-down`) — Bluente's only two bilingual layouts, previously reachable only through the numeric `vertical_bilingual` flag, which is now a deprecated alias.
- **`file_url` and `file_content_base64`** as file sources alongside `file_path`, plus `file_to_translate` for hosts that supply attachments.
- **`task_id`** on the workflow tool, to translate a file that is already uploaded.
- **`pptx`** output format, and arrays of formats on the workflow tool (`["word", "pdf"]`) — extra formats are download-time conversions of one translation and cost no extra credits.

### Changed

- **Translation options are sent as query parameters on start**, which is what the backend actually reads. They were previously sent in the request body, where `bilingual`, `vertical_bilingual`, and `scanned` were silently ignored.
- **`to_type` is now `pdf` / `word` / `pptx`** (was `pdf` / `docx` / `xlsx`, which the backend does not accept). `word` is the default.
- **`entry` / `status_entry` is now `get_status` / `get_page_count`** (was `pdf` / `word`).
- **`auto_download` now defaults to `false`**, returning as soon as translation starts instead of blocking for minutes and risking an MCP client timeout. Poll `bluente_get_translation_status`, then call `bluente_download_file`.
- **`engine` is pinned to the single engine the platform runs.** The `GTC`/`LLM`/`PPE` enum did not correspond to anything the backend accepted.
- The upload is now polled to `SERVICE_PROCESSED` before translation starts; `max_poll_attempts` is one budget shared across both phases.
- Downloads report `translate_id`, `file_name`, `content_type`, and `bytes` alongside `output_path`, and accept `include_file_content` for base64 (refused over 2MB). With several formats, `output_path` names the first and the rest are saved beside it rather than in the server's working directory.

## [0.3.0] - 2026-08-27

### Changed

- **Bilingual output now defaults to off.** Previously `bilingual` defaulted to `"line"`, so every translation kept the original text alongside the translation unless callers opted out. The flag is now `on`/`off` (default `off`); `none`, `line`, and `paragraph` are accepted as legacy aliases. The API flag is binary — `line` and `paragraph` were never distinct.
- **Glossary is always on in the workflow tool.** The backend applies the glossary only when both `glossary` and `custom_glossary` are set, so enabling one without the other silently did nothing. `bluente_translate_document_workflow` now sends both flags on every start (matching the web product default) and ignores the deprecated `glossary`/`custom_glossary` arguments. The raw `bluente_translate_file` tool keeps both flags for full control.
- Supported-languages responses are trimmed to `{code, name}` per language instead of full verbose backend records.

### Added

- **Language-code aliasing.** Bluente uses nonstandard codes (`zh`, `cht`, `jp`, `kor`, `fra`, `spa`); common ISO spellings (`zh-CN`, `zh-TW`, `ja`, `ko`, `fr`, `es`, ...) are now auto-mapped case-insensitively. Unknown codes pass through so the backend stays the single validator.
- **`mode` parameter** with the real four document modes: `standard`, `scanned (text)` (OCR into a clean text-only document), `scanned (overlay)` (translation placed back in the original layout), and `image` (re-render a graphic such as a brochure or poster in the target language; charged 5 credits per page). The numeric `scanned` flag remains as a deprecated 0–3 alias — previously it was capped at 0/1, so overlay and image modes were unreachable.
- **`page_range` parameter** (e.g. `"1-3,5"`) on both translate tools; credits are charged only for the selected pages.
- Scanned-document detection guidance in the workflow tool description (check for an extractable text layer; ask text-vs-overlay for scans).

## [0.2.0] - 2026-03-04

### Added

- Introduced layered project architecture (`config`, `clients`, `services`, `tools`, `lib`).
- Added one-file-per-tool MCP registration modules.
- Added unified MCP response envelope (`ok/tool/data` and structured errors).
- Added workflow service for upload -> translate -> poll -> download.
- Added open-source governance docs: `CONTRIBUTING.md`, `SECURITY.md`.
- Added GitHub Actions CI for Node.js 20/22 static checks and test execution.
- Added repository governance templates: `CODEOWNERS`, issue templates, PR template.
- Added no-network smoke tests for env loading and workflow orchestration behavior.

### Changed

- Replaced monolithic implementation with modular composition.
- Rewrote README with architecture and operational guidance.
- Bumped package version from `0.1.0` to `0.2.0`.
- Added MCP `isError` signaling for failed tool calls.
- Improved workflow polling with configurable `status_entry`.
- Relaxed translate cancel input requirements (only `start` requires `from` and `to`).
- Hardened environment timeout parsing with safe fallback.

## [0.1.0] - 2026-03-04

### Added

- Initial Node.js MCP server implementation for Bluente translation APIs.
- Core tools: supported languages, upload, status, translate, download, workflow.

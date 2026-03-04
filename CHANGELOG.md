# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

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

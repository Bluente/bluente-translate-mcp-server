# Security Policy

## Supported Versions

Security updates are currently provided for the latest released minor version.

## Reporting a Vulnerability

If you discover a security issue, please report it privately.

Recommended report content:

- Affected component/file
- Impact assessment
- Reproduction steps or proof of concept
- Suggested remediation (if available)

Please do not disclose the issue publicly until a fix is released.

## Secret Management

- Never commit `.env` files.
- Never paste real `BLUENTE_API_KEY` values in issues, PRs, or logs.
- Rotate API keys immediately if accidental exposure is suspected.

## Hardening Recommendations

- Use dedicated API keys per environment.
- Limit key scope where supported.
- Monitor API usage anomalies.
- Keep dependencies updated.

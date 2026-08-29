# Security Policy

## Supported scope

This repository serves a public, read-only Gray Zone Warfare data API. Report vulnerabilities in the API, web console, deployment configuration, or data publication workflow.

## Reporting a vulnerability

Please do not open a public GitHub issue for an undisclosed security problem. Use the private security reporting channel configured on the GitHub repository, or contact `security@gzw-data.dev` with:

- a short description and impact
- affected endpoint, workflow, or commit
- reproducible steps or a minimal proof of concept
- any suggested mitigation

Do not include real credentials, tokens, private URLs, or personal data in reports.

## API abuse and responsible testing

The public API is read-only and rate-limited on a best-effort basis. Keep testing low-volume, cache responses, respect `Retry-After`, and do not attempt denial-of-service testing, quota bypass, destructive requests, or access to systems outside this project.

## Response targets

We will acknowledge a report when practicable, validate the issue, communicate an initial severity, and coordinate a fix or mitigation. Timelines depend on impact and reproducibility.

## Data quality is not automatically a security issue

Incorrect game data, missing fields, or stale records should use the normal data-quality issue form unless they expose a security or privacy problem.

## Disclosure

Please allow a reasonable remediation window before public disclosure. We may credit reporters if they explicitly request it and it is safe to do so.

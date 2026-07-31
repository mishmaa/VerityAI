# Security policy

## Supported version

Security updates are applied to the latest revision of the `main` branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting feature on this repository. Include a clear
description, reproduction steps, affected endpoints or files, and potential
impact. You can expect an initial acknowledgement within seven days.

## Deployment notice

The checked-in Docker Compose defaults are for local development only. Before
deployment, use unique credentials, set `APP_ENV=production`, configure an
HTTPS reverse proxy, restrict CORS, use managed secret storage and object
storage, and enable production monitoring, backups, malware scanning, and
distributed rate limiting.

Never use real confidential documents in a public demonstration environment.

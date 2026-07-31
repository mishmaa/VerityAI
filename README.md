# VerityAI

[![CI](https://github.com/mishmaa/VerityAI/actions/workflows/ci.yml/badge.svg)](https://github.com/mishmaa/VerityAI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)

VerityAI is a secure, citation-first enterprise knowledge platform. Organizations can ingest private documents, search their knowledge base, and receive grounded answers with an auditable evidence trail.

## What is implemented

- FastAPI application with versioned routes and OpenAPI documentation
- organization-aware user model and role-based access control
- secure password hashing and short-lived JWT access tokens
- PDF, DOCX, TXT, and Markdown ingestion with safe tenant storage
- text extraction, overlapping chunks, ranked retrieval, and page-level citations
- evidence-only answers with explicit refusal when support is absent
- polished responsive React workspace for onboarding, uploads, questions, sources, people, collections, settings, and audit activity
- collection curation, pending teammate invitations, profile management, organization settings, and password rotation
- global document and evidence search with safe destructive-action confirmations
- organization-scoped audit trail
- PostgreSQL/pgvector production persistence and SQLite zero-setup development
- Alembic migrations, health/readiness endpoints, CORS, request IDs, and security headers
- Docker Compose deployment with PostgreSQL, Redis, FastAPI, Nginx, and React
- CI quality gates for linting, tests, coverage, and frontend builds

## Fastest start: Docker

```powershell
docker compose up --build
```

Open `http://localhost:8080`. The API documentation is available at `http://localhost:8000/docs`.

The Compose defaults are intended only for local development. Copy `.env.example` to `.env` and replace credentials before using a shared or production environment.

## Developer setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item ..\.env.example ..\.env
uvicorn app.main:app --reload
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and use `http://localhost:8000/docs` for the API.

## Test

```powershell
cd backend
pytest

cd ../frontend
npm run lint
npm test
```

## Verification

```powershell
cd backend
ruff check app tests
ruff format --check app tests alembic
pytest --cov=app --cov-fail-under=85

cd ../frontend
npm run build

cd ..
docker compose config --quiet
docker compose build backend frontend
```

## Architecture

```text
Browser -> Nginx/React -> FastAPI -> PostgreSQL + pgvector
                              |   -> tenant file storage
                              +   -> Redis (background-work foundation)
```

The local answer provider is intentionally deterministic and extractive: it proves retrieval, authorization, citation, and refusal behavior without requiring a paid API key. The provider boundary is designed for a later grounded LLM generator while preserving the same evidence contract.

## Repository layout

```text
backend/       FastAPI API, persistence, migrations, and tests
frontend/      React/Vite product interface and client tests
docs/          Architecture, security, evaluation, and demo material
.github/       GitHub Actions quality gates
```

## Security and responsible use

VerityAI is a portfolio-grade reference implementation, not a certified production security product. Review [SECURITY.md](SECURITY.md) and [docs/security.md](docs/security.md) before any public deployment. Never commit `.env`, uploaded documents, access tokens, or real company data.

## Next product investments

1. pgvector embeddings and PostgreSQL full-text hybrid retrieval
2. queued ingestion workers and object storage
3. configurable grounded LLM providers and answer streaming
4. versioned evaluation datasets and an evaluation dashboard
5. invitation acceptance/email delivery, collection-level permissions, SSO, and SCIM
6. malware scanning, distributed rate limits, and production observability

See [architecture](docs/architecture.md), [security](docs/security.md), and [evaluation](docs/evaluation.md) for the engineering decisions and release standards.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local workflow and quality gates. This project is available under the [MIT License](LICENSE).

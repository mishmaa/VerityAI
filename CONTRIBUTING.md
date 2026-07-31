# Contributing

Thanks for improving VerityAI. Keep changes focused, tenant-safe, and covered
by tests.

## Local workflow

1. Create a branch from `main`.
2. Follow the setup instructions in `README.md`.
3. Add or update tests for behavior changes.
4. Run the release checks below.
5. Open a pull request that explains the change, risk, and verification.

## Release checks

```powershell
cd backend
ruff check app tests
ruff format --check app tests alembic
pytest --cov=app --cov-fail-under=85

cd ../frontend
npm run lint
npm test
npm run build

cd ..
docker compose config --quiet
```

Do not commit secrets, `.env` files, uploaded documents, generated coverage,
virtual environments, or dependency directories.

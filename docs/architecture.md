# Architecture

## Product boundary

VerityAI answers questions only from evidence a user is authorized to access. Tenant isolation, source traceability, and explicit refusal are product requirements rather than optional enhancements.

## Planned runtime

```text
React workspace -> FastAPI API -> PostgreSQL + pgvector
                         |       -> object storage
                         +------ -> Redis-backed workers
                         +------ -> configurable LLM provider
```

## Core decisions

- **Modular monolith first:** one deployable backend with clear module boundaries. This keeps early operations simple without coupling domain logic.
- **Organization in every protected record:** authorization is enforced server-side and queries are scoped to the active organization.
- **Provider abstraction:** extraction, embeddings, vector search, and generation will use interfaces so providers can be replaced.
- **Evidence before generation:** retrieval results and permissions are resolved before an answer reaches an LLM.
- **Measurable quality:** every release will be checked against a versioned evaluation set for retrieval recall, citation correctness, groundedness, latency, and cost.

## Threats considered from day one

- cross-tenant data exposure
- malicious files and oversized uploads
- prompt injection inside documents
- insecure direct object references
- leaked secrets or tokens
- hallucinated claims without citations

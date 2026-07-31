# Quality evaluation

The product should not be judged by whether an answer sounds fluent. Releases should be evaluated against a versioned set of questions, expected source documents, expected passages, and reference claims.

## Required metrics

- retrieval recall at 5
- mean reciprocal rank
- citation precision
- claim groundedness
- refusal accuracy when evidence is absent
- cross-tenant isolation failures (target: zero)
- p50 and p95 latency
- ingestion throughput and failure rate
- cost per answered question when a generative provider is enabled

## Release gate

A release fails if tenant isolation regresses, citation precision drops below the accepted baseline, or unsupported-answer refusal accuracy declines. Latency and cost regressions require an explicit recorded decision.

# Security model

VerityAI treats authorization and evidence boundaries as part of answer correctness.

## Implemented controls

- Argon2 password hashing; plaintext passwords are never stored.
- Short-lived signed access tokens containing user, organization, and role claims.
- Every protected database query is scoped to the authenticated organization.
- Uploaded objects use generated storage keys rather than user-controlled paths.
- File type allowlisting, streaming size limits, duplicate detection, and empty-file rejection.
- Security response headers and explicit CORS origins.
- Audit events for organization creation, authentication, uploads, deletion, and knowledge queries.
- Production startup refuses default or short signing secrets.
- Grounded responses refuse when no authorized evidence is found.

## Production controls still required at infrastructure level

- TLS termination and managed secret storage
- object-storage encryption and lifecycle policies
- malware scanning before document processing
- Redis-backed distributed rate limiting
- database row-level security as defense in depth
- centralized logs, metrics, alerting, backups, and restore drills
- independent penetration testing and dependency scanning

## Prompt-injection posture

Uploaded text is evidence, never an instruction source. A future generative provider must place retrieved content in a clearly delimited evidence block, prohibit tool execution based on document text, and require claim-level citation validation before returning an answer.

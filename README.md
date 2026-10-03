# MAATAA API

API foundation for MAATAA and TLPS. Internal SSO uses self-hosted Keycloak as the OIDC authority. The API validates access tokens and enforces canonical tenant membership through explicit adapter ports.

## Current state

- Authentication and tenant-boundary code is implemented.
- Proposed role/action matrix awaits business-owner sign-off; permissions remain empty until approval and policy implementation.
- The `preflight` environment is declared but blocked on verified host, identity, database, schema, and secret-reference facts.
- No raw credentials, live realm, database adapter, production deployment, or migration are present.

## Documents

- [Identity, sessions, and trusted actor context](docs/identity-and-sessions.md)
- [Authorization matrix proposal](docs/authorization-matrix.md)
- [Environment bindings](docs/environments/README.md)
- [Preflight environment record](environments/preflight.json)

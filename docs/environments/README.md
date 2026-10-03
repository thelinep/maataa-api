# Environment binding records

Environment records distinguish intended configuration from verified infrastructure. A named record is not evidence that a server, identity realm, database, hostname, or secret has been provisioned.

## `preflight`

[`environments/preflight.json`](../../environments/preflight.json) declares the non-production preflight target for `maataa-api` and the requested `api.tlps.in` hostname. It records the previously selected PostgreSQL target and Keycloak authority as intentions only. Provider versions, database/schema identity, issuer/realm, hosting owner/provider, hostname verification, and secret references are still absent; therefore status remains `BLOCKED_MISSING_VERIFIED_BINDING`.

Populate `secretReference` with an opaque reference understood by the selected host's secret manager (for example, a secret ID or vault path). Never populate secret values, tokens, passwords, private keys, or connection strings in this record or Git. Keep fields `null` until their exact values are verified; do not substitute sample values for real infrastructure facts.

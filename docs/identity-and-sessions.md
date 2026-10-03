# Identity, sessions, and tenant trust boundary

Status: implementation policy for the API boundary; Keycloak deployment values and database adapters are not yet supplied.

## Identity provider

Use self-hosted **Keycloak** as MAATAA/TLPS internal SSO, configured as an OpenID Connect issuer. `maataa-api` is a resource server; it does not collect passwords, issue tokens, refresh tokens, or own the browser login session.

Clients use Authorization Code with PKCE S256. Do not enable implicit flow or resource-owner password credentials. Configure a dedicated API audience (`maataa-api`) and explicitly allow-list first-party client IDs in `AUTH_ALLOWED_CLIENT_IDS`. The API accepts RS256 access tokens only, verifies the signature from the configured issuer's JWKS, and checks issuer, audience, authorized party, issue time, expiry, token ID, and maximum age.

## Session authority and expiry

- **Create:** Keycloak authenticates the user and creates its SSO session after the OIDC Authorization Code + PKCE flow.
- **API credential:** Keycloak issues a signed access token with `iat`, `exp`, `jti`, `sub`, `iss`, `aud`, and `azp`. The API never accepts an ID token as a bearer API credential.
- **Refresh:** the OIDC client refreshes through Keycloak's token endpoint; enable refresh-token rotation/reuse detection in the Keycloak realm/client policy.
- **Validate:** every API request validates the bearer access token signature and required claims, then maps `(iss, sub)` to an active MAATAA `identity.users` record. Missing identity/membership adapters fail closed and make readiness return 503.
- **Expire:** proposed initial policy is a 5-minute access-token lifetime, 30-minute SSO idle timeout, and 12-hour SSO maximum. Configure these in Keycloak; the API independently rejects tokens older than 5 minutes (configurable only within 1–10 minutes). No production realm has been configured here.
- **Logout/revocation:** logout is performed against Keycloak's OIDC logout endpoint and terminates its SSO session. The API is stateless and does not introspect each request; a previously issued access token can remain usable until its short expiry. If immediate revocation becomes a requirement, add a reviewed revocation/introspection or denylist design before claiming it.

## Trusted actor claims

| Claim | Trust/use |
| --- | --- |
| `iss` | Must exactly equal configured Keycloak realm issuer. |
| `sub` | Stable IdP subject; mapped only as `(iss, sub)` to `identity.users.id`. Never map by email. |
| `aud` | Must contain the configured API audience. |
| `azp` | Must match an explicitly allowed first-party client ID. |
| `iat`, `exp`, `jti` | Required; age and expiry checked. `jti` is retained in the request actor for audit correlation, not logged by default. |
| `email`, display name | Presentation hints only; never identity keys or authorization inputs. |
| `roles`, groups, `organisation_id`, `workspace_id` | Not authorization grants in this API. Ignore them unless a separately reviewed mapping is implemented. |

The canonical actor is an API-created object after token verification and active-user lookup. Request headers such as `X-User-ID`, `X-Organisation-ID`, `X-Workspace-ID`, and client-supplied role fields are untrusted. Tenant IDs may be selected in route parameters, but each request must check the active canonical membership in that tenant. Workspace operations must check both active organisation membership and active workspace membership with the same user, organisation, and workspace IDs. Role-to-permission policy must be added explicitly; membership alone does not imply every action is permitted.

## Canonical data mapping

MAATAA's reviewed contracts define global `identity.users`, `organisation.organisation_memberships`, and `organisation.workspace_memberships`. The auth boundary therefore exposes two adapter ports:

- `identityDirectory.findByIssuerAndSubject(issuer, subject)` returns canonical `userId` and account status.
- `membershipDirectory.findActiveOrganisationMembership(...)` and `findActiveWorkspaceMembership(...)` query canonical membership rows and return active membership records.

No external-subject column or new canonical table is invented by this package. The selected persistence implementation must provide a reviewed mapping from Keycloak `(iss, sub)` to the canonical global user. Until these adapters exist, `/readyz` remains 503 and tenant-scoped authorization fails closed.

## Configuration

See `.env.example`. Production requires HTTPS for issuer/JWKS URLs and all secrets/configuration must be supplied by the host secret manager. No Keycloak credentials, client secrets, realm data, database URLs, cookies, or tokens belong in this repository. The API accepts tokens only through `Authorization: Bearer`; it does not create a second API session cookie.

## Current implementation boundary

This repository currently contains the verifier, canonical actor mapping port, membership checks, a minimal `/v1/me` integration surface, and fail-closed readiness behavior. It is not a deployed Keycloak realm or persistence-backed production API. Host/domain binding, database adapter, client registration, permission matrix, and deployment remain separate integrations.

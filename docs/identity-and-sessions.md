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

## Trusted claim and actor-context format

There are two distinct formats: the **signed Keycloak access-token claims** and the **server-derived MAATAA actor context**. The latter is created only after token verification, active-user resolution, and (for tenant routes) live membership checks. A `/v1/me` response is informational and must never be accepted back as proof of identity or authorization.

### Signed OIDC access-token claims

| Claim | Required | Trust and use |
| --- | --- | --- |
| `iss` | Yes | Exact configured Keycloak realm issuer. |
| `sub` | Yes | Stable Keycloak subject; resolve only as `(iss, sub)` to `identity.users.id`. Never resolve by email. |
| `aud` | Yes | Must include the configured `maataa-api` audience. |
| `azp` | Yes | Must match `AUTH_ALLOWED_CLIENT_IDS`. |
| `iat`, `exp`, `jti` | Yes | Numeric issue/expiry times and non-empty token ID; enforce expiry and max age. |
| `nbf` | If present | Enforce not-before time through JWT validation. |
| `email`, name/profile claims | Optional | Display/contact hints only. Not identity keys or authorization inputs. |
| `roles`, groups, `scope`, `user_id`, `actor_type`, organisation/workspace claims | Ignored as grants | They do not become MAATAA permissions or tenant authority merely because the token is signed. |

### Server-derived `maataa.actor-context.v1`

The API passes this object to handlers after verifying the authority chain. This exact JSON shape is the trusted in-process format; IDs and permissions shown in an HTTP response remain untrusted if a client sends them back.

```json
{
  "schemaVersion": "maataa.actor-context.v1",
  "actorType": "human",
  "userId": "canonical identity.users.id UUID",
  "identity": {
    "issuer": "exact configured OIDC issuer",
    "subject": "verified OIDC sub",
    "clientId": "verified allowed azp"
  },
  "session": {
    "tokenId": "verified jti",
    "issuedAt": 1791072000,
    "expiresAt": 1791072300
  },
  "tenant": {
    "organisationId": "UUID from the requested route, membership-checked",
    "organisationMembershipId": "active canonical membership row ID",
    "organisationRole": "member",
    "workspaceId": "optional UUID from the requested route, membership-checked",
    "workspaceMembershipId": "optional active canonical membership row ID",
    "workspaceRole": "optional canonical workspace role"
  },
  "permissions": []
}
```

Field rules:

- `actorType` is `human` only after `(iss, sub)` maps to an active `identity.users` row. `service` is reserved and rejected until a service-principal authority and mapping are designed; it must not be inferred from an unknown human.
- `userId` is MAATAA's canonical UUID, never a client-supplied `user_id` or an assumed Keycloak subject.
- `tenant` is `null` on an identity-only request. Organisation and workspace IDs come from the request path and must be checked against active membership rows for this same `userId`.
- `organisationRole` is read from the active canonical organisation membership (`owner`, `admin`, `member`, or `viewer`). `workspaceRole` is read from the active workspace membership (`admin`, `editor`, or `viewer`). These roles are context-scoped, not global.
- `permissions` is a sorted, unique array of permission identifiers produced by a reviewed server-side role/grant policy. **That policy is not implemented yet, so the current value is always empty and grants no action permissions.** A role name alone does not imply an API operation is allowed.
- `identity.subject` and `session.tokenId` are for identity/audit correlation; never log bearer tokens. Client headers such as `X-User-ID`, `X-Organisation-ID`, `X-Workspace-ID`, and role/permission fields are untrusted.

The canonical actor/context is rebuilt for each request. No tenant or permission authority is cached in a long-lived JWT. Current implementation checks membership for tenant-context routes but does not yet provide resource-level permission grants.

## Canonical data mapping

MAATAA's reviewed contracts define global `identity.users`, `organisation.organisation_memberships`, and `organisation.workspace_memberships`. The auth boundary therefore exposes two adapter ports:

- `identityDirectory.findByIssuerAndSubject(issuer, subject)` returns canonical `userId` and account status.
- `membershipDirectory.findActiveOrganisationMembership(...)` and `findActiveWorkspaceMembership(...)` query canonical membership rows and return active membership records.

No external-subject column or new canonical table is invented by this package. The selected persistence implementation must provide a reviewed mapping from Keycloak `(iss, sub)` to the canonical global user. Until these adapters exist, `/readyz` remains 503 and tenant-scoped authorization fails closed.

## Configuration

See `.env.example`. Production requires HTTPS for issuer/JWKS URLs and all secrets/configuration must be supplied by the host secret manager. No Keycloak credentials, client secrets, realm data, database URLs, cookies, or tokens belong in this repository. The API accepts tokens only through `Authorization: Bearer`; it does not create a second API session cookie.

## Current implementation boundary

This repository currently contains the verifier, canonical actor mapping port, membership checks, a minimal `/v1/me` integration surface, and fail-closed readiness behavior. It is not a deployed Keycloak realm or persistence-backed production API. Host/domain binding, database adapter, client registration, permission matrix, and deployment remain separate integrations.

# Authorization matrix proposal

**Policy:** `maataa.authorization.matrix.v1`

**Version:** `0.1.0`

**Status:** PROPOSED — business-owner sign-off required

**Scope:** tenant-scoped product resources

## Actions

| Action | Meaning |
| --- | --- |
| `read` | View the resource and its non-secret details. Export/download remains subject to resource-specific policy. |
| `edit` | Create or change non-approved resource data. Approval transitions are excluded. |
| `approve` | Approve or reject an eligible review transition. Maker-checker applies: the author or most recent editor cannot approve their own change. |
| `delete` | Soft-delete a resource where its lifecycle allows. Permanent purge is excluded and needs a separate policy. |
| `administer` | Manage roles, scoped grants, and settings within an already-authorized tenant. It does not imply platform-wide root access. |

## Proposed role × action matrix

`ALLOW` applies only after authentication, tenant membership, resource state, and the constraints below pass. `DENY` is final for that role/action pair.

| Role | Read | Edit | Approve | Delete | Administer |
| --- | --- | --- | --- | --- | --- |
| **admin** | ALLOW | ALLOW | ALLOW* | ALLOW | ALLOW |
| **editor** | ALLOW | ALLOW | DENY | DENY | DENY |
| **viewer** | ALLOW | DENY | DENY | DENY | DENY |
| **approver** | ALLOW | DENY | ALLOW* | DENY | DENY |

`*` Approval is denied when the actor authored or most recently edited the change, regardless of role.

## Mapping from current MAATAA membership rows

The current canonical role enums do not exactly match this policy. This is a **proposal requiring sign-off**, not an already-approved mapping:

| Canonical membership role | Effective policy role proposed |
| --- | --- |
| Organisation `owner` | `admin` |
| Organisation `admin` | `admin` |
| Organisation `member` | `editor` |
| Organisation `viewer` | `viewer` |
| Workspace `admin` | `admin` |
| Workspace `editor` | `editor` |
| Workspace `viewer` | `viewer` |
| `approver` | No current canonical membership role. Requires a separately approved, tenant-scoped grant source; no fallback assignment. |

Organisation membership remains required for workspace operations. The workspace role is effective only for that workspace. Role and permission values in Keycloak tokens or request headers are ignored.

## Permission identifier format

Permissions are server-derived identifiers in the format `<resource>.<action>`, for example `spatial.layout.read` or `spatial.layout.approve`. A role grants only the listed action on resources within the verified tenant scope. Wildcard permissions are not part of this proposal.

## Approval and enforcement status

- **Business owner:** not designated in the repository.
- **Decision:** PENDING.
- **Sign-off artifact:** `authorization-matrix-approval.json`, bound to the SHA-256 of the proposed JSON matrix.
- **Runtime:** current trusted actor context returns `permissions: []`. This proposal is not enforced until an accountable business owner approves the exact hash and the permission resolver is implemented against canonical membership/grant records.

Approval should record the business owner's name/role, decision, timestamp, exact proposal hash, and any conditions. Do not change status to APPROVED or enable grants without that record.

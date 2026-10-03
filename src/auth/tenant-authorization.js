import { AuthorizationError, IdentityDependencyUnavailable } from './errors.js';

/**
 * Tenant context is selected by the request path, then checked against live
 * membership records. Signed tenant/role claims are intentionally not used as
 * grants because memberships and roles can change before a token expires.
 */
export async function requireOrganisationMembership(actor, organisationId, membershipDirectory) {
  if (!actor?.userId || !organisationId) throw new AuthorizationError();
  if (!membershipDirectory) throw new IdentityDependencyUnavailable();

  let membership;
  try {
    membership = await membershipDirectory.findActiveOrganisationMembership({
      userId: actor.userId,
      organisationId,
    });
  } catch {
    throw new IdentityDependencyUnavailable();
  }

  if (!membership || membership.status !== 'active') throw new AuthorizationError();
  return Object.freeze({ actor, organisationId, membershipId: membership.id });
}

/** Enforce both organisation and workspace membership for a workspace request. */
export async function requireWorkspaceMembership(
  actor,
  organisationId,
  workspaceId,
  membershipDirectory,
) {
  const organisationScope = await requireOrganisationMembership(
    actor,
    organisationId,
    membershipDirectory,
  );

  let membership;
  try {
    membership = await membershipDirectory.findActiveWorkspaceMembership({
      userId: actor.userId,
      organisationId,
      workspaceId,
    });
  } catch {
    throw new IdentityDependencyUnavailable();
  }

  if (!membership || membership.status !== 'active') throw new AuthorizationError();
  return Object.freeze({
    ...organisationScope,
    workspaceId,
    workspaceMembershipId: membership.id,
  });
}

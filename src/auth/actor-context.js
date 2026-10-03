/**
 * Build the server-owned identity/tenant context passed to application handlers.
 * Never construct this object by copying claims or fields from a client request.
 */
export function createTrustedActorContext(actor, { tenant = null, permissions = [] } = {}) {
  if (!actor || actor.actorType !== 'human' || !actor.userId) {
    throw new TypeError('A resolved human actor is required');
  }
  if (!Array.isArray(permissions) || permissions.some((permission) => typeof permission !== 'string')) {
    throw new TypeError('permissions must be an array of permission identifiers');
  }

  const normalizedPermissions = [...new Set(permissions)].sort();
  const context = {
    schemaVersion: 'maataa.actor-context.v1',
    actorType: 'human',
    userId: actor.userId,
    identity: Object.freeze({
      issuer: actor.issuer,
      subject: actor.subject,
      clientId: actor.clientId,
    }),
    session: Object.freeze({
      tokenId: actor.tokenId,
      issuedAt: actor.issuedAt,
      expiresAt: actor.expiresAt,
    }),
    tenant: tenant ? Object.freeze({ ...tenant }) : null,
    permissions: Object.freeze(normalizedPermissions),
  };
  return Object.freeze(context);
}

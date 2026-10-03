import { AuthenticationError, IdentityDependencyUnavailable } from './errors.js';

const bearerToken = (authorization) => {
  if (typeof authorization !== 'string') throw new AuthenticationError();
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  if (!match) throw new AuthenticationError();
  return match[1];
};

/**
 * Resolve a signed Keycloak identity to the canonical identity.users row.
 * Implementations must bind the pair (issuer, subject), never email alone.
 */
export async function authenticateActor(authorization, { tokenVerifier, identityDirectory }) {
  if (!tokenVerifier || !identityDirectory) {
    throw new IdentityDependencyUnavailable();
  }

  const token = await tokenVerifier.verifyAccessToken(bearerToken(authorization));
  let identity;
  try {
    identity = await identityDirectory.findByIssuerAndSubject(token.issuer, token.subject);
  } catch {
    throw new IdentityDependencyUnavailable();
  }

  if (!identity || identity.status !== 'active' || typeof identity.userId !== 'string') {
    throw new AuthenticationError();
  }

  return Object.freeze({
    actorType: 'human',
    userId: identity.userId,
    issuer: token.issuer,
    subject: token.subject,
    tokenId: token.tokenId,
    clientId: token.clientId,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
  });
}

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthenticationError } from './errors.js';

const requiredString = (payload, key) => {
  const value = payload[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AuthenticationError();
  }
  return value;
};

export function createOidcAccessTokenVerifier(config, { jwks } = {}) {
  const keySet = jwks ?? createRemoteJWKSet(config.jwksUri);

  return Object.freeze({
    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(token, keySet, {
          issuer: config.issuer,
          audience: config.audience,
          algorithms: ['RS256'],
          requiredClaims: ['sub', 'iat', 'exp', 'jti', 'azp'],
          maxTokenAge: config.maxTokenAgeSeconds,
          clockTolerance: 5,
        });

        const clientId = requiredString(payload, 'azp');
        if (!config.allowedClientIds.includes(clientId)) {
          throw new AuthenticationError();
        }

        return Object.freeze({
          issuer: requiredString(payload, 'iss'),
          subject: requiredString(payload, 'sub'),
          tokenId: requiredString(payload, 'jti'),
          clientId,
          issuedAt: payload.iat,
          expiresAt: payload.exp,
        });
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        throw new AuthenticationError();
      }
    },
  });
}

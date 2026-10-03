import { createServer } from 'node:http';
import { authenticateActor } from '../auth/actor.js';
import { createTrustedActorContext } from '../auth/actor-context.js';
import {
  requireOrganisationMembership,
  requireWorkspaceMembership,
} from '../auth/tenant-authorization.js';
import {
  AuthenticationError,
  AuthorizationError,
  IdentityDependencyUnavailable,
} from '../auth/errors.js';

const json = (response, status, body, extraHeaders = {}) => {
  const encoded = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(encoded),
    ...extraHeaders,
  });
  response.end(encoded);
};

export function createApiServer({ tokenVerifier, identityDirectory, membershipDirectory }) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/healthz') {
      return json(response, 200, { status: 'ok' });
    }

    if (request.method === 'GET' && url.pathname === '/readyz') {
      const ready = Boolean(tokenVerifier && identityDirectory && membershipDirectory);
      return json(response, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready' });
    }

    const tenantRoute = /^\/v1\/organisations\/([^/]+)(?:\/workspaces\/([^/]+))?\/access$/.exec(url.pathname);
    if (request.method === 'GET' && (url.pathname === '/v1/me' || tenantRoute)) {
      try {
        const actor = await authenticateActor(request.headers.authorization, {
          tokenVerifier,
          identityDirectory,
        });
        if (url.pathname === '/v1/me') {
          return json(response, 200, {
            actor: createTrustedActorContext(actor),
          });
        }

        const [, organisationId, workspaceId] = tenantRoute;
        const scope = workspaceId
          ? await requireWorkspaceMembership(actor, organisationId, workspaceId, membershipDirectory)
          : await requireOrganisationMembership(actor, organisationId, membershipDirectory);
        const { actor: resolvedActor, ...tenant } = scope;
        return json(response, 200, {
          actor: createTrustedActorContext(resolvedActor, { tenant }),
        });
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return json(response, 401, { error: 'unauthorized' }, {
            'www-authenticate': 'Bearer realm="maataa-api"',
          });
        }
        if (error instanceof AuthorizationError) {
          return json(response, 403, { error: 'tenant_access_denied' });
        }
        if (error instanceof IdentityDependencyUnavailable) {
          return json(response, 503, { error: 'identity_authority_unavailable' });
        }
        return json(response, 500, { error: 'internal_error' });
      }
    }

    return json(response, 404, { error: 'not_found' });
  });
}

import { loadAuthConfig } from './auth/config.js';
import { createOidcAccessTokenVerifier } from './auth/oidc-verifier.js';
import { createApiServer } from './http/server.js';

const config = loadAuthConfig();
const server = createApiServer({
  tokenVerifier: createOidcAccessTokenVerifier(config),
  // Canonical identity and membership adapters are deliberately not guessed.
  // Inject them from the selected persistence package before marking ready.
});

const port = Number(process.env.PORT ?? '8787');
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be valid');
server.listen(port, host, () => {
  process.stdout.write(`maataa-api listening on ${host}:${port}; readiness remains blocked until canonical adapters are bound\n`);
});

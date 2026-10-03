const required = (env, key) => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const httpsUrl = (value, key, allowLocalHttp) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be an absolute URL`);
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:')) {
    throw new Error(`${key} must use HTTPS outside local development`);
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`${key} must not contain credentials or a fragment`);
  }
  return url;
};

export function loadAuthConfig(env = process.env) {
  const issuer = required(env, 'AUTH_ISSUER_URL');
  const jwksUri = required(env, 'AUTH_JWKS_URL');
  const audience = required(env, 'AUTH_API_AUDIENCE');
  const allowedClientIds = required(env, 'AUTH_ALLOWED_CLIENT_IDS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedClientIds.length === 0) {
    throw new Error('AUTH_ALLOWED_CLIENT_IDS must contain at least one client ID');
  }

  const isProduction = env.NODE_ENV === 'production';
  const issuerUrl = httpsUrl(issuer, 'AUTH_ISSUER_URL', !isProduction);
  const jwksUrl = httpsUrl(jwksUri, 'AUTH_JWKS_URL', !isProduction);
  if (issuerUrl.origin !== jwksUrl.origin) {
    throw new Error('AUTH_JWKS_URL must share the configured issuer origin');
  }

  const maxTokenAgeSeconds = Number(env.AUTH_MAX_TOKEN_AGE_SECONDS ?? '300');
  if (!Number.isInteger(maxTokenAgeSeconds) || maxTokenAgeSeconds < 60 || maxTokenAgeSeconds > 600) {
    throw new Error('AUTH_MAX_TOKEN_AGE_SECONDS must be an integer from 60 to 600');
  }

  return Object.freeze({
    issuer,
    jwksUri: jwksUrl,
    audience,
    allowedClientIds: Object.freeze(allowedClientIds),
    maxTokenAgeSeconds,
  });
}

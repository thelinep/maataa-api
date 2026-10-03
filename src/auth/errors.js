export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class IdentityDependencyUnavailable extends Error {
  constructor(message = 'Identity or membership authority is unavailable') {
    super(message);
    this.name = 'IdentityDependencyUnavailable';
  }
}

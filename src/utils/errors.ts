export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string) {
    super(message);
  }
} 
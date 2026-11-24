export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, "not_found", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this") {
    super(message, "forbidden", 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in required") {
    super(message, "unauthorized", 401);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly issues: unknown[] = [],
  ) {
    super(message, "validation_error", 400);
  }
}

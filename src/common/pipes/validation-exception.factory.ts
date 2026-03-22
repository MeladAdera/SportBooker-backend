import { UnprocessableEntityException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Formats class-validator ValidationError[] into field-level errors.
 * Use with ValidationPipe exceptionFactory to return 422 with structure:
 * { message: string, errors: { field: string; messages: string[] }[] }
 */
export function createValidationExceptionFactory() {
  return (errors: ValidationError[]) => {
    const formatted = errors
      .map((err) => ({
        field: err.property,
        messages: err.constraints
          ? Object.values(err.constraints)
          : (err.children?.flatMap((c) => Object.values(c.constraints ?? {})) ??
            []),
      }))
      .filter((e) => e.messages.length > 0);

    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: formatted,
    });
  };
}

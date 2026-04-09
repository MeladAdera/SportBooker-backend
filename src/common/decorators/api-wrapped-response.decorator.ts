import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

type AnyConstructor = Type<unknown>;

interface WrappedResponseOptions {
  status: number;
  type?: AnyConstructor;
  description?: string;
  /** Inline schema for when there's no class (e.g. `{ message: string }`). */
  schema?: Record<string, unknown>;
}

/**
 * Emits an @ApiResponse whose schema reflects the TransformInterceptor envelope:
 *   { data: <type>, statusCode: <number> }
 *
 * Use instead of @ApiOkResponse / @ApiCreatedResponse for success responses
 * so orval-generated types match the actual wire shape.
 */
function ApiWrappedResponse(options: WrappedResponseOptions): MethodDecorator {
  const { status, type, description, schema: inlineSchema } = options;

  const dataSchema: Record<string, unknown> = type
    ? { $ref: getSchemaPath(type) }
    : inlineSchema
      ? inlineSchema
      : { type: 'object' };

  const decorators = [
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        required: ['data', 'statusCode'],
        properties: {
          data: dataSchema,
          statusCode: { type: 'number', example: status },
        },
      },
    }),
  ];

  if (type) {
    decorators.unshift(ApiExtraModels(type));
  }

  return applyDecorators(...decorators);
}

export function ApiWrappedOkResponse(
  options: Omit<WrappedResponseOptions, 'status'>,
): MethodDecorator {
  return ApiWrappedResponse({ ...options, status: HttpStatus.OK });
}

export function ApiWrappedCreatedResponse(
  options: Omit<WrappedResponseOptions, 'status'>,
): MethodDecorator {
  return ApiWrappedResponse({ ...options, status: HttpStatus.CREATED });
}

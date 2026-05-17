# Validation & Response Envelope — Study Guide

A comprehensive guide to understanding input validation, error handling, and response shaping in this NestJS API.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Request Lifecycle: The Big Picture](#2-request-lifecycle-the-big-picture)
3. [ValidationPipe](#3-validationpipe)
4. [HttpExceptionFilter](#4-httpexceptionfilter)
5. [TransformInterceptor](#5-transforminterceptor)
6. [LoggingInterceptor](#6-logginginterceptor)
7. [Putting It All Together](#7-putting-it-all-together)
8. [Writing DTOs](#8-writing-dtos)
9. [Common Decorators Reference](#9-common-decorators-reference)
10. [Verification Checklist](#10-verification-checklist)

---

## 1. Overview

Every API needs:

| Need | Solution |
|------|----------|
| Reject invalid input before it reaches controllers | **ValidationPipe** + DTOs |
| Consistent error response shape | **HttpExceptionFilter** |
| Consistent success response shape | **TransformInterceptor** |
| Observability (what ran, how long) | **LoggingInterceptor** |

All four are registered **globally** in `main.ts`, so they apply to every route without per-controller configuration.

---

## 2. Request Lifecycle: The Big Picture

```
Request → LoggingInterceptor (start timer)
       → ValidationPipe (validate @Body/@Query/@Param)
         └─ Invalid? → HttpExceptionFilter → Response (422/400)
       → Controller (handler)
       → TransformInterceptor (wrap in { data, statusCode })
       → LoggingInterceptor (log duration)
       → Response
```

**Success path:** Request passes validation → controller runs → TransformInterceptor wraps result → LoggingInterceptor logs.

**Error path:** Validation fails or controller throws HttpException → HttpExceptionFilter catches → returns `{ statusCode, message, timestamp }` (and `errors` for 422) → TransformInterceptor is skipped for that request.

---

## 3. ValidationPipe

**File:** `src/main.ts`  
**Purpose:** Validate incoming data against DTO class rules before the controller runs.

### How It Works

1. Controller has `@Body() dto: CreateUserDto`
2. NestJS reads the request body (plain object from JSON)
3. ValidationPipe runs `class-validator.validate(dto)` using decorators on `CreateUserDto`
4. If valid: controller receives a validated, transformed object
5. If invalid: `exceptionFactory` is called → throws `UnprocessableEntityException` (422)

### Configuration Options

```typescript
new ValidationPipe({
  whitelist: true,           // Strip properties not in DTO
  forbidNonWhitelisted: true, // Throw if unknown properties exist
  transform: true,           // Coerce types (string → number, etc.)
  exceptionFactory: createValidationExceptionFactory(),
})
```

#### `whitelist: true`

- **Without:** `{ email: "a@b.com", isAdmin: true }` → controller receives both
- **With:** `isAdmin` is removed; controller receives only `{ email }` (only fields with decorators are kept)

Prevents accidentally passing through extra fields you never intended to accept.

#### `forbidNonWhitelisted: true`

- **Without whitelist:** unknown fields are silently dropped
- **With forbidNonWhitelisted:** unknown fields cause a 422 error

Example: `{ email: "a@b.com", isAdmin: true }` → 422 with `"property isAdmin should not exist"`.

This blocks mass assignment: attackers can't inject `isAdmin`, `role`, etc.

#### `transform: true`

- Query params and bodies are strings; decorators like `@IsNumber()` expect numbers
- **transform: true** uses `class-transformer` to convert types before validation

Example: `?page=3` (string) → `page: 3` (number) for `@IsNumber() page`.

Requires `class-transformer` as a dependency.

#### `exceptionFactory`

- Default: `BadRequestException` (400)
- Custom: return `UnprocessableEntityException` (422) with structured field errors

---

## 4. HttpExceptionFilter

**File:** `src/common/filters/http-exception.filter.ts`  
**Purpose:** Normalize all `HttpException` responses to a single shape.

### What It Catches

Any `HttpException` (and subclasses):

- `BadRequestException` (400)
- `UnauthorizedException` (401)
- `ForbiddenException` (403)
- `NotFoundException` (404)
- `UnprocessableEntityException` (422)
- `InternalServerErrorException` (500)
- Any custom exception extending `HttpException`

### Response Shape

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "timestamp": "2026-03-21T21:00:31.757Z",
  "errors": [
    { "field": "email", "messages": ["email must be an email"] },
    { "field": "name", "messages": ["name must be longer than or equal to 2 characters"] }
  ]
}
```

- `statusCode` — from `exception.getStatus()`
- `message` — from the exception or `body.message`
- `timestamp` — ISO 8601
- `errors` — included only when present (e.g. validation failures)

### Code Walkthrough

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // exception.getResponse() can be string or object
    const body =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as Record<string, unknown>)
        : { message: exceptionResponse };

    const payload = {
      statusCode: status,
      message: body.message ?? exception.message,
      timestamp: new Date().toISOString(),
    };
    if (body.errors !== undefined) payload.errors = body.errors;

    res.status(status).json(payload);
  }
}
```

- `ArgumentsHost` — adapter over HTTP/WebSocket/etc.; `switchToHttp()` for HTTP
- `exception.getResponse()` — string or object; we normalize to an object
- We explicitly forward `errors` so 422 validation responses include field-level details

---

## 5. TransformInterceptor

**File:** `src/common/interceptors/transform.interceptor.ts`  
**Purpose:** Wrap all successful responses in `{ data, statusCode }`.

### Success Response Shape

```json
{
  "data": { "id": "123", "email": "a@b.com" },
  "statusCode": 200
}
```

- `data` — what the controller returned
- `statusCode` — from `res.statusCode` (200, 201, etc.)

### When It Runs

Only for **successful** requests. If a pipe or controller throws, the exception filter handles the response and this interceptor does not wrap it.

### Code Walkthrough

```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse();

    return next.handle().pipe(
      map((data) => ({
        data,
        statusCode: res.statusCode,
      })),
    );
  }
}
```

- `next.handle()` returns an `Observable` of the controller's return value
- `map()` wraps that value in `{ data, statusCode }`
- `res.statusCode` is set by NestJS (e.g. 201 for `@Post()`)

---

## 6. LoggingInterceptor

**File:** `src/common/interceptors/logging.interceptor.ts`  
**Purpose:** Log method, path, status, and duration for every request.

### Output

```
GET / 200 4ms
POST /test-validation 422 12ms
POST /users 201 45ms
```

Format: `METHOD path STATUS duration`.

### Code Walkthrough

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
        },
        error: () => {
          const duration = Date.now() - start;
          console.log(`${req.method} ${req.path} error ${duration}ms`);
        },
      }),
    );
  }
}
```

- `tap()` runs side effects when the observable emits (`next`) or errors (`error`)
- We measure duration from before `next.handle()` until the response is sent
- For errors, we still log duration and mark it as `error` (status may not be set)

---

## 7. Putting It All Together

### Registration Order (`main.ts`)

```typescript
app.useGlobalPipes(new ValidationPipe({ ... }));
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalInterceptors(
  new LoggingInterceptor(),   // First: starts timer
  new TransformInterceptor(), // Last: wraps response
);
```

- **Pipes** run during parameter binding (before controller)
- **Filters** run when an exception is thrown
- **Interceptors** run in order: first registered = outermost; Logging first, Transform last

### Interceptor Order

```
Request → LoggingInterceptor → TransformInterceptor → Controller
Response ← LoggingInterceptor ← TransformInterceptor ← Controller
```

Transform runs after the controller; Logging runs before and after (via `tap`).

---

## 8. Writing DTOs

**File:** `src/app.dto.ts` (example)

### Basic Example

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}
```

### Using in a Controller

```typescript
@Post('users')
create(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

- `@Body()` tells NestJS to parse the request body
- ValidationPipe validates against `CreateUserDto` before the handler runs
- `dto` is typed and validated

### Nested Objects

Use `@ValidateNested()` and `@Type()`:

```typescript
import { Type } from 'class-transformer';
import { IsEmail, IsString, ValidateNested } from 'class-validator';

class AddressDto {
  @IsString()
  street!: string;

  @IsString()
  city!: string;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}
```

### Optional vs Required

```typescript
@IsOptional()
@IsString()
nickname?: string;  // Can be omitted

@IsString()
email!: string;    // Required
```

### Query Params

```typescript
@Get()
findAll(
  @Query('page') @Type(() => Number) @IsNumber() page: number = 1,
  @Query('limit') @Type(() => Number) @IsNumber() limit: number = 10,
) {
  // page and limit are numbers, not strings
}
```

With `transform: true` you can use `transformOptions: { enableImplicitConversion: true }` to avoid `@Type()` on every param.

---

## 9. Common Decorators Reference

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@IsString()` | Must be string | name, title |
| `@IsNumber()` | Must be number | age, count |
| `@IsInt()` | Must be integer | page, limit |
| `@IsBoolean()` | Must be boolean | isActive |
| `@IsEmail()` | Valid email format | email |
| `@IsUUID()` | Valid UUID | id |
| `@IsEnum(MyEnum)` | Value in enum | status |
| `@Min(n)` | Number ≥ n | @Min(0) |
| `@Max(n)` | Number ≤ n | @Max(100) |
| `@MinLength(n)` | String length ≥ n | @MinLength(3) |
| `@MaxLength(n)` | String length ≤ n | @MaxLength(100) |
| `@IsOptional()` | Field can be undefined | nickname? |
| `@IsArray()` | Must be array | tags |
| `@IsObject()` | Must be plain object | metadata |
| `@ValidateNested()` | Validate nested object | address |
| `@Type(() => Class)` | Transform to class (for nested) | @Type(() => AddressDto) |

Docs: [class-validator](https://github.com/typestack/class-validator), [class-transformer](https://github.com/typestack/class-transformer)

---

## 10. Verification Checklist

Run these with the app on `http://localhost:3000`:

| Test | Command | Expected |
|------|---------|----------|
| Success envelope | `curl -s http://localhost:3000/` | `{"data":"Hello World!","statusCode":200}` |
| Validation 422 | `curl -s -X POST http://localhost:3000/test-validation -H "Content-Type: application/json" -d '{"email":"bad","name":"x"}'` | 422, `errors` with field messages |
| forbidNonWhitelisted | `curl -s -X POST ... -d '{"email":"a@b.com","name":"John","isAdmin":true}'` | 422, "property isAdmin should not exist" |
| Valid POST | `curl -s -X POST ... -d '{"email":"a@b.com","name":"John"}'` | `{"data":{...},"statusCode":201}` |
| Logging | Check app terminal | Lines like `GET / 200 4ms` |

---

## Quick Reference: File Locations

| Component | Path |
|-----------|------|
| ValidationPipe + registration | `src/main.ts` |
| exceptionFactory | `src/common/pipes/validation-exception.factory.ts` |
| HttpExceptionFilter | `src/common/filters/http-exception.filter.ts` |
| TransformInterceptor | `src/common/interceptors/transform.interceptor.ts` |
| LoggingInterceptor | `src/common/interceptors/logging.interceptor.ts` |
| Example DTO | `src/app.dto.ts` |

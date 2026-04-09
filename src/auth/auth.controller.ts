import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiWrappedCreatedResponse,
  ApiWrappedOkResponse,
} from '../common/decorators/api-wrapped-response.decorator';
import { Tenant } from '../common/tenant.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Tenant as TenantDecorator } from './decorators/tenant.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiWrappedCreatedResponse({
    description: 'User registered',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid subdomain' })
  @ApiResponse({ status: 403, description: 'Tenant is inactive' })
  @ApiResponse({
    status: 409,
    description: 'Email already registered for this tenant',
  })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - rate limit exceeded',
  })
  async register(
    @Body() dto: RegisterDto,
    @TenantDecorator() tenant: Tenant,
  ): Promise<RegisterResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.authService.register(dto, tenant.id);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiWrappedOkResponse({
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid subdomain' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Tenant is inactive' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - rate limit exceeded',
  })
  async login(
    @Body() dto: LoginDto,
    @TenantDecorator() tenant: Tenant,
  ): Promise<LoginResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.authService.login(dto, tenant.id);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiWrappedOkResponse({
    description:
      'If email exists, reset link sent. Always 200 (anti-enumeration).',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid subdomain' })
  @ApiResponse({ status: 403, description: 'Tenant is inactive' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - rate limit exceeded',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @TenantDecorator() tenant: Tenant,
  ): Promise<{ message: string }> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    await this.authService.forgotPassword(dto, tenant.id, tenant.slug);
    return {
      message:
        'If an account exists with that email, a reset link has been sent.',
    };
  }

  @Post('reset-password')
  @Public()
  @ApiWrappedOkResponse({
    description: 'Password reset successfully',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @Public()
  @ApiWrappedOkResponse({
    description: 'New tokens issued',
    type: RefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async refresh(@Body() dto: RefreshDto): Promise<RefreshResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiWrappedOkResponse({
    description: 'Logged out successfully',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.authService.logout(user.sub);
  }
}

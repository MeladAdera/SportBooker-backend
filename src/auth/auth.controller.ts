import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: 201,
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
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid subdomain' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Tenant is inactive' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
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
  @ApiResponse({
    status: 200,
    description:
      'If email exists, reset link sent. Always 200 (anti-enumeration).',
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid subdomain' })
  @ApiResponse({ status: 403, description: 'Tenant is inactive' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
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
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    schema: { properties: { message: { type: 'string' } } },
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
  @ApiResponse({
    status: 200,
    description: 'New tokens issued',
    type: RefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async refresh(@Body() dto: RefreshDto): Promise<RefreshResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.authService.logout(user.sub);
  }
}

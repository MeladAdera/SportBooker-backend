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
import { Public } from './decorators/public.decorator';
import { Tenant as TenantDecorator } from './decorators/tenant.decorator';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { AuthService } from './auth.service';

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
}

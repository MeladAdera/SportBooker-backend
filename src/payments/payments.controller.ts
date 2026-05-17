import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { Tenant } from '../common/tenant.types';
import { UserRole } from '../users/user-role';
import { ApiWrappedOkResponse } from '../common/decorators/api-wrapped-response.decorator';
import { CreateTopupDto } from './dto/create-topup.dto';
import { TopupResponseDto } from './dto/topup-response.dto';
import { PaymentsService, type ZiinaWebhookPayload } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('topup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantRequiredGuard, RolesGuard)
  @Roles(UserRole.Player)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Initiate a wallet top-up',
    description:
      'Player only. Creates a Ziina payment intent and returns the hosted payment URL. ' +
      'Redirect the player to `redirectUrl` to complete payment.',
  })
  @ApiWrappedOkResponse({ type: TopupResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiUnprocessableEntityResponse({
    description: 'Online top-up not configured for this tenant',
  })
  async createTopup(
    @Body() dto: CreateTopupDto,
    @CurrentUser() user: AuthenticatedUser,
    @TenantDecorator() tenant: Tenant,
  ): Promise<TopupResponseDto> {
    return this.paymentsService.createTopup({
      tenant,
      userId: user.sub,
      amount: dto.amount,
    });
  }

  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ziina webhook receiver',
    description:
      'Receives payment status events from Ziina. Not for direct client use. ' +
      'Verifies IP allowlist and HMAC signature before crediting wallets.',
  })
  @ApiOkResponse({ description: 'Acknowledged' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hmac-signature') hmacSignature: string | undefined,
    @Body() payload: ZiinaWebhookPayload,
  ): Promise<void> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.warn('Webhook received without raw body — skipping');
      return;
    }

    const clientIp = this.extractIp(req);

    await this.paymentsService.handleWebhook({
      rawBody,
      hmacSignature,
      clientIp,
      payload,
    });
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string')
      return forwarded.split(',')[0]?.trim() ?? '';
    if (Array.isArray(forwarded)) return forwarded[0] ?? '';
    return req.socket.remoteAddress ?? '';
  }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from './auth/auth.types';
import { AppService } from './app.service';
import { TestValidationDto } from './app.dto';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getHello(): string {
    return this.appService.getHello();
  }

  /** Test endpoint: validates DTO, returns wrapped response. Use to verify validation + envelope. */
  @Post('test-validation')
  @Public()
  @ApiResponse({
    status: 201,
    description: 'Validation passed, returns received data',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiResponse({
    status: 422,
    description: 'Validation failed (field-level errors)',
  })
  testValidation(@Body() dto: TestValidationDto) {
    return { received: dto };
  }

  /** Protected route: requires valid JWT. Use to verify auth scaffold. */
  @Get('protected')
  @ApiResponse({ status: 200, description: 'Returns current user from token' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  getProtected(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}

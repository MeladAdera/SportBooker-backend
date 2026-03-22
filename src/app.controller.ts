import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { TestValidationDto } from './app.dto';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getHello(): string {
    return this.appService.getHello();
  }

  /** Test endpoint: validates DTO, returns wrapped response. Use to verify validation + envelope. */
  @Post('test-validation')
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
}

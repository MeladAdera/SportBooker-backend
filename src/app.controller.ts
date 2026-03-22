import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { TestValidationDto } from './app.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Test endpoint: validates DTO, returns wrapped response. Use to verify validation + envelope. */
  @Post('test-validation')
  testValidation(@Body() dto: TestValidationDto) {
    return { received: dto };
  }
}

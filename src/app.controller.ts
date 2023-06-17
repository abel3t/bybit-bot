import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { OkxService } from './okx.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private okxService: OkxService) {}

  @Get('/')
  root() {
    return 'Welcome!';
  }

  @Post('webhook/buy/:symbol')
  handleWebhook(@Param('symbol') symbol: string, @Body('key') key: string) {
    return this.appService.handleWebhook(symbol, key);
  }

  @Post('webhook/trade/:symbol')
  handleTradeWebhook(
    @Param('symbol') symbol: string,
    @Body('key') key: string,
  ) {
    return this.okxService.handleWebhook(symbol, key);
  }
}

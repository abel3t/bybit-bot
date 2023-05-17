import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import axios from 'axios';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('webhook/:type')
  handleWebhook(@Param('type') type: string) {
    return this.appService.handleWebhook(type);
  }
}

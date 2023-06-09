import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import * as dotEnv from 'dotenv';

dotEnv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT || 8081);

  console.log('App is running on port', process.env.PORT || 8081);
}
bootstrap();

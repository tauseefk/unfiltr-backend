import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppGateway } from './app.gateway';
import { ServeStaticModule } from '@nestjs/serve-static'
import { join } from 'path';
import { AppService } from './app.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'client'),
    }),
  ],
  controllers: [AppController],
  providers: [AppGateway, AppService],
})
export class AppModule {}

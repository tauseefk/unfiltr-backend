import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller('/api/v0')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/potatoes')
  getStats(): string {
    return this.appService.getStats()
  }
}

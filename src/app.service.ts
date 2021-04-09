import { Injectable } from '@nestjs/common'
import stats from './stats'

@Injectable()
export class AppService {
  getStats(): string {
    return `${stats.getMessageCount()} messages exchanged since ${stats.getLastRestart()}`
  }
}

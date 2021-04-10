import { Logger } from '@nestjs/common'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Socket, Server } from 'socket.io'
import { events } from '../events'
import { v1 } from 'uuid'
import stats from './stats'

const debounce = (fn: Function, ms: number) => {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn.bind(null, ...args), ms)
  }
}

@WebSocketGateway()
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  connectedUsers = []

  d_stopTyping = debounce(({ socket, id }) => {
    socket.broadcast.emit(events.STOPPED_TYPING, { userId: id })
  }, 1000)

  @WebSocketServer() server: Server
  private logger: Logger = new Logger('AppGateway')

  @SubscribeMessage(events.NEW_MESSAGE)
  handleMessage(client: Socket, payload: any): void {
    stats.incrementMessageCount() // TODO: get better logging

    if (Buffer.isBuffer(payload)) {
      try {
        payload = JSON.parse(payload.toString())
      } catch (e) {
        console.error(e)
        return
      }
    }

    const updatedId = v1()
    client.broadcast.emit(events.NEW_MESSAGE, { ...payload, id: updatedId })
    client.emit(events.MESSAGE_ID, { ...payload, updatedId })
    client.broadcast.emit(events.STOPPED_TYPING, { userId: payload.from })
  }

  @SubscribeMessage(events.TYPING)
  handleTyping(client: Socket): void {
    const userId = client.id
    this.d_stopTyping({ socket: client, id: userId })
    client.broadcast.emit(events.TYPING, { userId })
  }

  @SubscribeMessage(events.EMPHASIZE_MESSAGE)
  handleEmphasize(client: Socket): void {
    client.broadcast.emit(events.EMPHASIZE_MESSAGE, { id: client.id })
  }

  afterInit(server: Server) {
    this.logger.log('init')
  }

  handleDisconnect(client: Socket) {
    const userId = client.id
    this.logger.log(`Client disconnected: ${userId}`)

    this.connectedUsers = this.connectedUsers.filter((id) => id !== userId)
    client.broadcast.emit(events.USER_DISCONNETED, { userId })
  }

  handleConnection(client: Socket, ...args: any[]) {
    const userId = client.id
    this.logger.log(`Client connected: ${userId}`)

    if (!this.connectedUsers.find((id) => id === userId))
      this.connectedUsers.push(userId)

    client.emit(events.INFO, {
      id: userId,
      connectedUsers: this.connectedUsers,
    })

    client.broadcast.emit(events.USER_CONNECTED, { userId })
  }
}

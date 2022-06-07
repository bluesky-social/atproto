import { io, Socket } from 'socket.io-client'
import { ChannelMessage } from './messages.js'

export default class Client {
  host: string
  topic: string
  socket: Socket
  onMessage: ((message: ChannelMessage) => Promise<void>) | null

  constructor(host: string, topic: string) {
    this.socket = io(host)
    this.host = host
    this.topic = topic
    this.onMessage = null

    this.socket.emit('message', { type: 'join' })
    this.socket.on('message', (data: ChannelMessage) => {
      if (data.type === 'message' && this.onMessage !== null) {
        this.onMessage(data.message)
      }
    })
  }

  sendMessage(message: any): void {
    this.socket.emit('message', {
      type: 'message',
      message,
    })
  }

  close(): void {
    this.socket.close()
  }
}

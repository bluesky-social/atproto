import { io, Socket } from 'socket.io-client'

export default class Client {
  host: string
  topic: string
  socket: Socket
  onMessage: ((message: any) => void) | null

  constructor(host: string, topic: string) {
    this.socket = io(host)
    this.host = host
    this.topic = topic
    this.onMessage = null

    this.socket.emit('message', { type: 'join', channel: topic })
    this.socket.on('message', (data: any) => {
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

  async awaitMessage(msgTypes: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.onMessage = (msg: any) => {
        if (msgTypes.indexOf(msg.type) > -1) {
          this.onMessage = null
          resolve(msg)
          return
        } else if (msg.type === 'Awake_Terminate') {
          reject(new Error(`Other party terminated AWAKE: ${msg.error}`))
          return
        }
      }
    })
  }

  close(): void {
    this.socket.close()
  }
}

import express from 'express'
import http from 'http'
import { Server, Socket } from 'socket.io'
import { Message } from './messages'

const runServer = (port: number): http.Server => {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  const channels: Record<string, Record<string, Socket>> = {}
  const channelForSocket: Record<string, string> = {}

  const addToChannel = (channelName: string, socket: Socket) => {
    if (channels[channelName] === undefined) {
      channels[channelName] = {}
    }
    channels[channelName][socket.id] = socket
    channelForSocket[socket.id] = channelName
  }

  const broadcastToChannel = (
    channelName: string,
    senderId: string,
    message: Message,
  ) => {
    const channel = channels[channelName]
    const members = Object.entries(channel)
    members.forEach(([id, socket]) => {
      if (id !== senderId) {
        socket.emit('message', {
          type: 'message',
          channel: channelName,
          message,
        })
      }
    })
  }

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      const channelName = channelForSocket[socket.id]
      if (channelName) {
        delete channels[channelName][socket.id]
        if (Object.values(channels[channelName]).length < 1) {
          delete channels[channelName]
        }
      }
    })
    socket.on('message', (data: Message) => {
      switch (data.type) {
        case 'join': {
          addToChannel(data.channel, socket)
          break
        }
        case 'message': {
          const channel = channelForSocket[socket.id]
          broadcastToChannel(channel, socket.id, data.message)
          break
        }
      }
    })
  })

  server.listen(port)
  return server
}

export default runServer

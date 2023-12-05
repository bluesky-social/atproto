import http from 'http'
import events from 'events'
import express from 'express'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import routes from './routes'

export class DataPlaneServer {
  constructor(public server: http.Server) {}

  static async create(port: number) {
    const app = express()
    app.use(expressConnectMiddleware({ routes }))
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new DataPlaneServer(server)
  }

  async stop() {
    return new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}

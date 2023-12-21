import http from 'http'
import events from 'events'
import express from 'express'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import createRoutes from './routes'
import { Database } from '../../db'

export class DataPlaneServer {
  constructor(public server: http.Server) {}

  static async create(db: Database, port: number) {
    const app = express()
    const routes = createRoutes(db)
    app.use(expressConnectMiddleware({ routes }))
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new DataPlaneServer(server)
  }

  async destroy() {
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

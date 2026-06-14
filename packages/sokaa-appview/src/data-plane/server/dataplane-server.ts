import events from 'node:events'
import http from 'node:http'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import express from 'express'
import { Database } from './db'
import createRoutes from './routes'

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

  get url() {
    const addr = this.server.address()
    if (!addr || typeof addr === 'string') {
      throw new Error('DataPlaneServer not listening')
    }
    return `http://127.0.0.1:${addr.port}`
  }

  async destroy() {
    this.server.closeAllConnections?.()
    return new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

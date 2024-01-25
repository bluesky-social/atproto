import http from 'http'
import events from 'events'
import express from 'express'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import createRoutes from './routes'
import { Database } from './db'
import { IdResolver, MemoryCache } from '@atproto/identity'

export { DidSqlCache } from './did-cache'
export { RepoSubscription } from './subscription'

export class DataPlaneServer {
  constructor(public server: http.Server) {}

  static async create(db: Database, port: number, plcUrl?: string) {
    const app = express()
    const idResolver = new IdResolver({
      plcUrl,
      didCache: new MemoryCache(),
    })
    const routes = createRoutes(db, idResolver)
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

import events from 'node:events'
import http from 'node:http'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import express from 'express'
import { IdResolver, MemoryCache } from '@atproto/identity'
import { Database } from './db'
import createRoutes from './routes'

export { RepoSubscription } from './subscription'

export class DataPlaneServer {
  constructor(
    public server: http.Server,
    public idResolver: IdResolver,
  ) {}

  static async create(db: Database, port: number, plcUrl?: string) {
    const app = express()
    const didCache = new MemoryCache()
    const idResolver = new IdResolver({ plcUrl, didCache })
    const routes = createRoutes(db, idResolver)
    app.use(expressConnectMiddleware({ routes }))
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new DataPlaneServer(server, idResolver)
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

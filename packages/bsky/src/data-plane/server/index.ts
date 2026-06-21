import events from 'node:events'
import http from 'node:http'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import express from 'express'
import { IdResolver, MemoryCache } from '@atproto/identity'
import { Database, DatabaseSchema } from './db/index.js'
import createRoutes from './routes/index.js'

export type { DatabaseSchema }

export { RepoSubscription } from './subscription.js'

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
      // `server.close()` only resolves once all connections are closed, but it
      // does not close idle keep-alive connections (e.g. those held open by the
      // appview's data plane client). Force them closed so shutdown is not
      // blocked waiting for them to hit the server's keepAliveTimeout.
      this.server.closeAllConnections()
    })
  }
}

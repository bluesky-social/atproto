import events from 'node:events'
import http from 'node:http'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import express from 'express'
import { DidCache, IdResolver, MemoryCache } from '@atproto/identity'
import { Database, DatabaseSchema } from './db'
import createRoutes from './routes'

export type { DatabaseSchema }

export { RepoSubscription } from './subscription'

export { StreamIndexer } from './indexer'

export { RedisDidCache } from './redis-did-cache'

export {
  BackfillIngester,
  FirehoseIngester,
  type IngesterOptions,
} from './ingester'

export class DataPlaneServer {
  constructor(
    public server: http.Server,
    public idResolver: IdResolver,
  ) {}

  static async create(
    db: Database,
    port: number,
    plcUrl?: string,
    didCache: DidCache = new MemoryCache(),
  ) {
    const app = express()
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

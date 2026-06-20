import events from 'node:events'
import http from 'node:http'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import express from 'express'
import { IdResolver, MemoryCache } from '@atproto/identity'
import { Database, DatabaseSchema } from './db/index.js'
import { PollCloser } from './poll-closer.js'
import createRoutes from './routes/index.js'

export type { DatabaseSchema }

export { RepoSubscription } from './subscription.js'
export { PollCloser } from './poll-closer.js'

export class DataPlaneServer {
  constructor(
    public server: http.Server,
    public idResolver: IdResolver,
    public pollCloser: PollCloser,
  ) {}

  static async create(db: Database, port: number, plcUrl?: string) {
    const app = express()
    const didCache = new MemoryCache()
    const idResolver = new IdResolver({ plcUrl, didCache })
    const routes = createRoutes(db, idResolver)
    app.use(expressConnectMiddleware({ routes }))
    const server = app.listen(port)
    await events.once(server, 'listening')
    const pollCloser = new PollCloser(db)
    pollCloser.start()
    return new DataPlaneServer(server, idResolver, pollCloser)
  }

  async destroy() {
    await this.pollCloser.destroy()
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

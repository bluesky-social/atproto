// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import { Database } from './db'
import * as error from './error'
import createRouter from './routes'
import { loggerMiddleware } from './logger'
import AppContext from './context'
import { createHttpTerminator } from 'http-terminator'

export * from './db'
export * from './context'

export class PlcServer {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: {
    db: Database
    port?: number
    version?: string
  }): PlcServer {
    const app = express()
    app.use(express.json({ limit: '100kb' }))
    app.use(cors())

    app.use(loggerMiddleware)

    const ctx = new AppContext({
      db: opts.db,
      version: opts.version || '0.0.0',
      port: opts.port,
    })

    app.use('/', createRouter(ctx))
    app.use(error.handler)

    return new PlcServer({
      ctx,
      app,
    })
  }

  async start(): Promise<http.Server> {
    const server = this.app.listen(this.ctx.port)
    this.server = server
    return new Promise((resolve, reject) => {
      server.on('listening', () => {
        resolve(server)
      })
      server.on('error', (err) => {
        reject(err)
      })
    })
  }

  async destroy(force = false) {
    if (this.server) {
      const terminator = createHttpTerminator({
        server: this.server,
        gracefulTerminationTimeout: force ? 0 : 5000,
      })
      await terminator.terminate()
    }
    await this.ctx.db.close()
  }
}

export default PlcServer

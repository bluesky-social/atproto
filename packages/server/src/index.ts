// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import * as auth from '@adxp/auth'
import API from './api'
import { IpldStore } from '@adxp/repo'
import Database from './db'
import ServerAuth from './auth'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig, ServerConfigValues } from './config'
import { DidResolver } from '@adxp/did-resolver'
import { Locals } from './locals'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'

const runServer = (
  blockstore: IpldStore,
  db: Database,
  keypair: auth.DidableKey,
  cfg: ServerConfigValues,
): http.Server => {
  const config = new ServerConfig(cfg)
  const didResolver = new DidResolver({ plcUrl: config.didPlcUrl })
  const auth = new ServerAuth({
    jwtSecret: cfg.jwtSecret,
    adminPass: cfg.adminPassword,
    didResolver,
  })

  const app = express()
  app.use(cors())
  app.use(loggerMiddleware)

  app.use((req, res, next) => {
    const locals: Locals = {
      // @ts-ignore
      logger: req.log,
      blockstore,
      db,
      keypair,
      auth,
      config,
    }
    res.locals = locals
    next()
  })

  const apiServer = API()
  app.use(apiServer.xrpc.router)
  app.use(error.handler)

  return app.listen(config.port)
}

export default runServer

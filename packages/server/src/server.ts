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
import * as error from './error'
import { ServerConfig, ServerConfigValues } from './config'

export { DidTestRegistry } from './lib/did/did-test'
export type { ServerConfigValues } from './config'

const runServer = (
  blockstore: IpldStore,
  db: Database,
  keypair: auth.DidableKey,
  cfg: ServerConfigValues,
): http.Server => {
  const config = new ServerConfig(cfg)

  const app = express()
  app.use(cors())

  app.use((_req, res, next) => {
    res.locals.blockstore = blockstore
    res.locals.db = db
    res.locals.keypair = keypair
    res.locals.config = config
    next()
  })

  const apiServer = API()
  app.use(apiServer.xrpc.router)
  app.use(error.handler)

  return app.listen(config.port)
}

export default runServer

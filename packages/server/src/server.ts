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

const runServer = (
  blockstore: IpldStore,
  db: Database,
  keypair: auth.DidableKey,
  port: number,
): http.Server => {
  const app = express()
  // app.use(express.json())
  app.use(cors())

  app.use((_req, res, next) => {
    res.locals.blockstore = blockstore
    res.locals.db = db
    res.locals.keypair = keypair
    next()
  })

  const apiServer = API()
  app.use(apiServer.xrpc.router)
  app.use(error.handler)

  return app.listen(port)
}

export default runServer

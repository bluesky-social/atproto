// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import Routes from './routes/index.js'
import { IpldStore } from '@adxp/common'
import Database from './db/index.js'
import * as error from './error.js'

const runServer = (
  blockstore: IpldStore,
  db: Database,
  port: number,
): http.Server => {
  const app = express()
  app.use(express.json())
  app.use(cors())

  app.use((_req, res, next) => {
    res.locals.blockstore = blockstore
    res.locals.db = db
    next()
  })

  app.use('/', Routes)
  app.use(error.handler)

  return app.listen(port)
}

export default runServer

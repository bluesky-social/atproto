// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import {Database} from './db/index'
// import * as error from './error'
import {Asymmetric} from './doc/types'
import router from './routes/index'

export const server = (
  db: Database,
  crypto: Asymmetric,
  port: number,
): http.Server => {
  const app = express()
  app.use(express.json())
  app.use(cors())

  app.use((_req, res, next) => {
    res.locals.db = db
    res.locals.crypto = crypto
    next()
  })
  
  app.use('/', router)
  // app.use(error.handler)

  return app.listen(port)
}

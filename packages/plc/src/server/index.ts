// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import { Database } from './db'
import * as error from './error'
import router from './routes'
import { Locals } from './locals'
import { loggerMiddleware, logger } from './logger'
export * from './db'

export type App = express.Application

export const server = (db: Database, port?: number, _version?: string) => {
  const version = _version || '0.0.0'
  const app = express()
  app.use(express.json({ limit: '100kb' }))
  app.use(cors())

  app.use(loggerMiddleware)

  const locals: Locals = {
    logger,
    version,
    db,
  }

  app.locals = locals

  app.use((req, res, next) => {
    const reqLocals: Locals = {
      ...locals,
      logger: req.log, // This logger is request-specific
    }
    res.locals = reqLocals
    next()
  })

  app.use('/', router)
  app.use(error.handler)

  const listener = app.listen(port)
  return { app, listener }
}

export default server

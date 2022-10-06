// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import * as auth from '@adxp/auth'
import API from './api'
import { IpldStore } from '@adxp/repo'
import Database from './db'
import ServerAuth from './auth'
import * as error from './error'
import { ServerConfig, ServerConfigValues } from './config'
import { DidResolver } from '@adxp/did-sdk'
import { ServerMailer } from './mailer'
import { createTransport } from 'nodemailer'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'

export type App = express.Application

const runServer = (
  blockstore: IpldStore,
  db: Database,
  keypair: auth.DidableKey,
  cfg: ServerConfigValues,
) => {
  const config = new ServerConfig(cfg)
  const didResolver = new DidResolver({ plcUrl: config.didPlcUrl })
  const auth = new ServerAuth({
    jwtSecret: cfg.jwtSecret,
    adminPass: cfg.adminPassword,
    didResolver,
  })

  const mailTransport =
    config.emailSmtpUrl !== undefined
      ? createTransport(config.emailSmtpUrl)
      : createTransport({ jsonTransport: true })

  const mailer = new ServerMailer(mailTransport, config)

  const app = express()
  app.use(cors())

  const locals = { blockstore, db, keypair, auth, config, mailer }
  Object.assign(app.locals, locals)

  app.use((_req, res, next) => {
    Object.assign(res.locals, locals)
    next()
  })

  const apiServer = API()
  app.use(apiServer.xrpc.router)
  app.use(error.handler)

  const listener = app.listen(config.port)
  return { app, listener }
}

export default runServer

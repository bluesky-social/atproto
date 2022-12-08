// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import * as auth from '@atproto/auth'
import API, { health } from './api'
import Database from './db'
import ServerAuth from './auth'
import * as error from './error'
import { httpLogger, loggerMiddleware } from './logger'
import { ServerConfig, ServerConfigValues } from './config'
import { DidResolver } from '@atproto/did-resolver'
import { Locals } from './locals'
import { ServerMailer } from './mailer'
import { createTransport } from 'nodemailer'
import SqlMessageQueue from './db/message-queue'
import { BlobStore } from '@atproto/repo'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'
export { DiskBlobStore, MemoryBlobStore } from './storage'

export type App = express.Application

const runServer = (
  db: Database,
  blobstore: BlobStore,
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

  const messageQueue = new SqlMessageQueue('pds', db, (did: string) => {
    return auth.verifier.loadAuthStore(keypair, [], did)
  })
  db.setMessageQueue(messageQueue)

  const mailTransport =
    config.emailSmtpUrl !== undefined
      ? createTransport(config.emailSmtpUrl)
      : createTransport({ jsonTransport: true })

  const mailer = new ServerMailer(mailTransport, config)

  const app = express()
  app.use(cors())
  app.use(loggerMiddleware)

  let imgUriEndpoint = config.imgUriEndpoint
  if (!imgUriEndpoint) {
    const imgProcessingCache = new BlobDiskCache(config.blobCacheLocation)
    const imgProcessingServer = new ImageProcessingServer(
      config.imgUriSalt,
      config.imgUriKey,
      blobstore,
      imgProcessingCache,
    )
    app.use('/image', imgProcessingServer.app)
    imgUriEndpoint = `${config.publicUrl}/image`
  }

  const imgUriBuilder = new ImageUriBuilder(
    imgUriEndpoint,
    cfg.imgUriSalt,
    cfg.imgUriKey,
  )

  const locals: Locals = {
    logger: httpLogger,
    db,
    blobstore,
    keypair,
    auth,
    imgUriBuilder,
    config,
    mailer,
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

  const apiServer = API({
    payload: {
      jsonLimit: 100 * 1024, // 100kb
      textLimit: 100 * 1024, // 100kb
      blobLimit: 5 * 1024 * 1024, // 5mb
    },
  })
  app.use(health.router)
  app.use(apiServer.xrpc.router)
  app.use(error.handler)

  const listener = app.listen(config.port)
  return { app, listener }
}

export default runServer

/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server'
import { Server } from '../../../index.js'
import { ComAtprotoAdminNS } from './admin/index.js'
import { ComAtprotoIdentityNS } from './identity/index.js'
import { ComAtprotoLabelNS } from './label/index.js'
import { ComAtprotoLexiconNS } from './lexicon/index.js'
import { ComAtprotoModerationNS } from './moderation/index.js'
import { ComAtprotoRepoNS } from './repo/index.js'
import { ComAtprotoServerNS } from './server/index.js'
import { ComAtprotoSyncNS } from './sync/index.js'
import { ComAtprotoTempNS } from './temp/index.js'

export class ComAtprotoNS {
  _server: Server
  admin: ComAtprotoAdminNS
  identity: ComAtprotoIdentityNS
  label: ComAtprotoLabelNS
  lexicon: ComAtprotoLexiconNS
  moderation: ComAtprotoModerationNS
  repo: ComAtprotoRepoNS
  server: ComAtprotoServerNS
  sync: ComAtprotoSyncNS
  temp: ComAtprotoTempNS

  constructor(server: Server) {
    this._server = server
    this.admin = new ComAtprotoAdminNS(server)
    this.identity = new ComAtprotoIdentityNS(server)
    this.label = new ComAtprotoLabelNS(server)
    this.lexicon = new ComAtprotoLexiconNS(server)
    this.moderation = new ComAtprotoModerationNS(server)
    this.repo = new ComAtprotoRepoNS(server)
    this.server = new ComAtprotoServerNS(server)
    this.sync = new ComAtprotoSyncNS(server)
    this.temp = new ComAtprotoTempNS(server)
  }
}

export * from './admin/index.js'
export * from './identity/index.js'
export * from './label/index.js'
export * from './lexicon/index.js'
export * from './moderation/index.js'
export * from './repo/index.js'
export * from './server/index.js'
export * from './sync/index.js'
export * from './temp/index.js'

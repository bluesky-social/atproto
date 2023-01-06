import { DidableKey } from '@atproto/auth'
import * as plc from '@atproto/plc'
import { Database } from './db'
import { ServerConfig } from './config'
import * as auth from './auth'
import { ServerMailer } from './mailer'
import { BlobStore } from '@atproto/repo'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import { MessageQueue } from './event-stream/types'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      blobstore: BlobStore
      keypair: DidableKey
      auth: auth.ServerAuth
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      mailer: ServerMailer
      services: Services
      messageQueue: MessageQueue
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get blobstore(): BlobStore {
    return this.opts.blobstore
  }

  get keypair(): DidableKey {
    return this.opts.keypair
  }

  get auth(): auth.ServerAuth {
    return this.opts.auth
  }

  get accessVerifier() {
    return auth.accessVerifier(this.auth)
  }

  get accessVerifierCheckTakedown() {
    return auth.accessVerifierCheckTakedown(this.auth, this)
  }

  get refreshVerifier() {
    return auth.refreshVerifier(this.auth)
  }

  get adminVerifier() {
    return auth.adminVerifier(this.auth)
  }

  get imgUriBuilder(): ImageUriBuilder {
    return this.opts.imgUriBuilder
  }

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get mailer(): ServerMailer {
    return this.opts.mailer
  }

  get services(): Services {
    return this.opts.services
  }

  get messageQueue(): MessageQueue {
    return this.opts.messageQueue
  }

  get plcClient(): plc.PlcClient {
    return new plc.PlcClient(this.cfg.didPlcUrl)
  }

  getAuthstore(did: string) {
    return this.auth.verifier.loadAuthStore(this.keypair, [], did)
  }
}

export default AppContext

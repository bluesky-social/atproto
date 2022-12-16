import { DidableKey } from '@atproto/auth'
import * as plc from '@atproto/plc'
import { Database } from './db'
import { ServerConfig } from './config'
import ServerAuth from './auth'
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
      auth: ServerAuth
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

  get auth(): ServerAuth {
    return this.opts.auth
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

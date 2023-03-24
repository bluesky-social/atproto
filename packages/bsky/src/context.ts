import * as plc from '@did-plc/lib'
import { Database } from './db'
import { ServerConfig } from './config'
import { BlobStore } from '@atproto/repo'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      blobstore: BlobStore
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      services: Services
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get blobstore(): BlobStore {
    return this.opts.blobstore
  }

  get imgUriBuilder(): ImageUriBuilder {
    return this.opts.imgUriBuilder
  }

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get services(): Services {
    return this.opts.services
  }

  get plcClient(): plc.Client {
    return new plc.Client(this.cfg.didPlcUrl)
  }
}

export default AppContext

import { IdResolver } from '@atproto/identity'
import { AuthVerifier } from './auth-verifier'
import { ServerConfig } from './config'
import { DataPlaneClient } from './data-plane/client'
import { Hydrator } from './hydration/hydrator'
import { Views } from './views'

export class AppContext {
  constructor(
    private opts: {
      cfg: ServerConfig
      dataplane: DataPlaneClient
      hydrator: Hydrator
      views: Views
      authVerifier: AuthVerifier
      idResolver: IdResolver
    },
  ) {}

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get dataplane(): DataPlaneClient {
    return this.opts.dataplane
  }

  get hydrator(): Hydrator {
    return this.opts.hydrator
  }

  get views(): Views {
    return this.opts.views
  }

  get authVerifier(): AuthVerifier {
    return this.opts.authVerifier
  }

  get idResolver(): IdResolver {
    return this.opts.idResolver
  }
}

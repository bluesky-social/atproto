import type { KwsConfig, ServerConfig } from '../../config.js'
import type { AppContext } from '../../context.js'
import type { KwsClient } from '../../kws.js'

export type AppContextWithAA = AppContext & {
  kwsClient: KwsClient
  cfg: ServerConfig & {
    kws: KwsConfig
  }
}

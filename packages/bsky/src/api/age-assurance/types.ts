import { KwsConfig, ServerConfig } from '../../config.js'
import { AppContext } from '../../context.js'
import { KwsClient } from '../../kws.js'

export type AppContextWithAA = AppContext & {
  kwsClient: KwsClient
  cfg: ServerConfig & {
    kws: KwsConfig
  }
}

import { KwsConfig, ServerConfig } from '../../config'
import { AppContext } from '../../context'
import { KwsClient } from '../../kws'

export type AppContextWithAA = AppContext & {
  kwsClient: KwsClient
  cfg: ServerConfig & {
    kws: KwsConfig
  }
}

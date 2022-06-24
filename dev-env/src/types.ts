export const PORTS = {
  PERSONAL_DATA_SERVER: 2583,
  WEB_SOCKET_RELAY: 3005,
  DID_WEB_HOST: 2582,
  KEY_MANAGER: 2581,
  EXAMPLE_APP: 3002,
  AUTH_LOBBY: 3000,
}

export interface ServerConfig {
  port: number
}

export interface StartParams {
  personalDataServer?: ServerConfig[]
  webSocketRelay?: ServerConfig[]
  didWebHost?: ServerConfig[]
  keyManager?: ServerConfig[]
  authLobby?: ServerConfig[]
  exampleApp?: ServerConfig[]
}

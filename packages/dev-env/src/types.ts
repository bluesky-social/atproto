export enum ServerType {
  PersonalDataServer = 'pds',
  WebSocketRelay = 'wsrelay',
  DidWebHost = 'didweb',
  KeyManager = 'keymanager',
  AuthLobby = 'auth',
  ExampleApp = 'example-app',
}

export interface ServerConfig {
  type: ServerType
  port: number
}

export interface StartParams {
  servers?: ServerConfig[]
}

export const PORTS = {
  [ServerType.PersonalDataServer]: 2583,
  [ServerType.WebSocketRelay]: 3005,
  [ServerType.DidWebHost]: 2582,
  [ServerType.KeyManager]: 2581,
  [ServerType.AuthLobby]: 3000,
  [ServerType.ExampleApp]: 3002,
}

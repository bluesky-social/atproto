export enum ServerType {
  PersonalDataServer = 'pds',
  DidWebHost = 'didweb',
  KeyManager = 'keymanager',
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
  [ServerType.DidWebHost]: 2582,
  [ServerType.KeyManager]: 2581,
}

export const SERVER_TYPE_LABELS = {
  [ServerType.PersonalDataServer]: 'personal data server',
  [ServerType.DidWebHost]: 'did:web host',
  [ServerType.KeyManager]: 'key manager',
}

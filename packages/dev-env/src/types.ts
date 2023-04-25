export enum ServerType {
  PersonalDataServer = 'pds',
  DidPlaceholder = 'plc',
  BskyAppView = 'bsky',
}

export interface ServerConfig {
  type: ServerType
  port: number
}

export interface StartParams {
  servers?: ServerConfig[]
}

export const PORTS = {
  [ServerType.BskyAppView]: 2584,
  [ServerType.PersonalDataServer]: 2583,
  [ServerType.DidPlaceholder]: 2582,
}

export const SERVER_TYPE_LABELS = {
  [ServerType.PersonalDataServer]: 'personal data server',
}

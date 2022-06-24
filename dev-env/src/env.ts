import dotenv from 'dotenv'
import { StartParams, ServerConfig } from './types.js'

const getPorts = (name: string): ServerConfig[] => {
  const portsStr = process.env[name]
  if (!portsStr) return []
  return portsStr
    .split(',')
    .map((str) => parseInt(str))
    .filter(Boolean)
    .map((port) => ({ port }))
}

export function load(): StartParams {
  dotenv.config()

  return {
    personalDataServer: getPorts('PERSONAL_DATA_SERVERS'),
    webSocketRelay: getPorts('WEB_SOCKET_RELAY'),
    didWebHost: getPorts('DID_WEB_HOST'),
    keyManager: getPorts('KEY_MANAGER'),
    authLobby: getPorts('AUTH_LOBBYS'),
    exampleApp: getPorts('EXAMPLE_APPS'),
  }
}

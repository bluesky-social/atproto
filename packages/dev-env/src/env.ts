import dotenv from 'dotenv'
import { StartParams, ServerType, ServerConfig } from './types.js'

const getPorts = (type: ServerType, name: string): ServerConfig[] => {
  const portsStr = process.env[name]
  if (!portsStr) return []
  return portsStr
    .split(',')
    .map((str) => parseInt(str))
    .filter(Boolean)
    .map((port) => ({ type, port }))
}

export function load(): StartParams {
  dotenv.config()

  return {
    servers: [
      ...getPorts(ServerType.PersonalDataServer, 'PERSONAL_DATA_SERVERS'),
    ],
  }
}

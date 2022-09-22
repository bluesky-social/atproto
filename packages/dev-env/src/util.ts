import getPort, { portNumbers } from 'get-port'
import { PORTS, ServerType, ServerConfig } from './types.js'

export async function genServerCfg(
  type: ServerType,
  port?: number,
): Promise<ServerConfig> {
  const basePort = PORTS[type]
  return {
    type,
    port: port || (await getPort({ port: portNumbers(basePort, 65535) })),
  }
}

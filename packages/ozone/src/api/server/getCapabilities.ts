import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, _ctx: AppContext) {
  server.add(tools.ozone.server.getCapabilities, async () => ({
    encoding: 'application/json' as const,
    body: { notifications: { channels: ['inApp'] } },
  }))
}

import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import listMembers from './listMembers.js'
import putMembers from './putMembers.js'
import removeMembers from './removeMembers.js'

export default function (server: Server, ctx: AppContext) {
  putMembers(server, ctx)
  removeMembers(server, ctx)
  listMembers(server, ctx)
}

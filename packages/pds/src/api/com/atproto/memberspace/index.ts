import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import listMembers from './listMembers.js'
import putMember from './putMember.js'
import removeMember from './removeMember.js'

export default function (server: Server, ctx: AppContext) {
  putMember(server, ctx)
  removeMember(server, ctx)
  listMembers(server, ctx)
}

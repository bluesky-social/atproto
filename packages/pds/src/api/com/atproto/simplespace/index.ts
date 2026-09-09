import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import createSpace from './createSpace.js'
import deleteSpace from './deleteSpace.js'
import getSpace from './getSpace.js'
import listMembers from './listMembers.js'
import putMember from './putMember.js'
import removeMember from './removeMember.js'
import updateSpace from './updateSpace.js'

export default function (server: Server, ctx: AppContext) {
  createSpace(server, ctx)
  updateSpace(server, ctx)
  deleteSpace(server, ctx)
  putMember(server, ctx)
  removeMember(server, ctx)
  listMembers(server, ctx)
  getSpace(server, ctx)
}

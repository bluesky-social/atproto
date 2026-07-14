import type { AppContext } from '../../context.js'
import type { Server } from '../../lexicon/index.js'
import getActorMetadata from './getActorMetadata.js'
import getConvo from './getConvo.js'
import getConvoMembers from './getConvoMembers.js'
import getConvos from './getConvos.js'
import getMessageContext from './getMessageContext.js'

export default function (server: Server, ctx: AppContext) {
  getActorMetadata(server, ctx)
  getConvo(server, ctx)
  getConvoMembers(server, ctx)
  getConvos(server, ctx)
  getMessageContext(server, ctx)
  return server
}

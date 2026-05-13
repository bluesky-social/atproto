import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'
import getActorMetadata from './getActorMetadata.js'
import getMessageContext from './getMessageContext.js'

export default function (server: Server, ctx: AppContext) {
  getActorMetadata(server, ctx)
  getMessageContext(server, ctx)
  return server
}

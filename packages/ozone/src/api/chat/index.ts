import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import getActorMetadata from './getActorMetadata'
import getMessageContext from './getMessageContext'

export default function (server: Server, ctx: AppContext) {
  getActorMetadata(server, ctx)
  getMessageContext(server, ctx)
  return server
}

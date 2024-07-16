import { Server } from '../../lexicon'
import AppContext from '../../context'
import getActorMetadata from './getActorMetadata'
import getMessageContext from './getMessageContext'

export default function (server: Server, ctx: AppContext) {
  getActorMetadata(server, ctx)
  getMessageContext(server, ctx)
  return server
}

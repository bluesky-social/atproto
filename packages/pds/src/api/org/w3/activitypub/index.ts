import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import getActor from './getActor'
import getOutbox from './getOutbox'

export default function (server: Server, ctx: AppContext) {
  getActor(server, ctx)
  getOutbox(server, ctx)
}

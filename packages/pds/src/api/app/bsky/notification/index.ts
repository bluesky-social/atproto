import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import registerPush from './registerPush'

export default function (server: Server, ctx: AppContext) {
  registerPush(server, ctx)
}

import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import registerPush from './registerPush'

export default function (server: Server, ctx: AppContext) {
  registerPush(server, ctx)
}

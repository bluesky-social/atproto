import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import mutePostThread from './mutePostThread'
import unmutePostThread from './unmutePostThread'

export default function (server: Server, ctx: AppContext) {
  mutePostThread(server, ctx)
  unmutePostThread(server, ctx)
}

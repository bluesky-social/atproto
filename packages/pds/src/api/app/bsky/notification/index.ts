import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import updateSeen from './updateSeen'

export default function (server: Server, ctx: AppContext) {
  updateSeen(server, ctx)
}

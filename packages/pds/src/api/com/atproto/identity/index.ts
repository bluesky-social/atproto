import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import resolveHandle from './resolveHandle'
import updateHandle from './updateHandle'

export default function (server: Server, ctx: AppContext) {
  resolveHandle(server, ctx)
  updateHandle(server, ctx)
}

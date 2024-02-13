import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import resolveHandle from './resolveHandle'
import updateHandle from './updateHandle'
import signPlcOp from './signPlcOp'
import sendPlcOp from './sendPlcOp'

export default function (server: Server, ctx: AppContext) {
  resolveHandle(server, ctx)
  updateHandle(server, ctx)
  signPlcOp(server, ctx)
  sendPlcOp(server, ctx)
}

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import resolveHandle from './resolveHandle'
import updateHandle from './updateHandle'
import requestPlcOperationSignature from './requestPlcOperationSignature'
import signPlcOperation from './signPlcOperation'

export default function (server: Server, ctx: AppContext) {
  resolveHandle(server, ctx)
  updateHandle(server, ctx)
  requestPlcOperationSignature(server, ctx)
  signPlcOperation(server, ctx)
}

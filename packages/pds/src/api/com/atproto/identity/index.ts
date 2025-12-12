import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import getRecommendedDidCredentials from './getRecommendedDidCredentials'
import requestPlcOperationSignature from './requestPlcOperationSignature'
import resolveHandle from './resolveHandle'
import signPlcOperation from './signPlcOperation'
import submitPlcOperation from './submitPlcOperation'
import updateHandle from './updateHandle'

export default function (server: Server, ctx: AppContext) {
  resolveHandle(server, ctx)
  updateHandle(server, ctx)
  getRecommendedDidCredentials(server, ctx)
  requestPlcOperationSignature(server, ctx)
  signPlcOperation(server, ctx)
  submitPlcOperation(server, ctx)
}

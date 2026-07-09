import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import getRecommendedDidCredentials from './getRecommendedDidCredentials.js'
import requestPlcOperationSignature from './requestPlcOperationSignature.js'
import resolveHandle from './resolveHandle.js'
import signPlcOperation from './signPlcOperation.js'
import submitPlcOperation from './submitPlcOperation.js'
import updateHandle from './updateHandle.js'

export default function (server: Server, ctx: AppContext) {
  resolveHandle(server, ctx)
  updateHandle(server, ctx)
  getRecommendedDidCredentials(server, ctx)
  requestPlcOperationSignature(server, ctx)
  signPlcOperation(server, ctx)
  submitPlcOperation(server, ctx)
}

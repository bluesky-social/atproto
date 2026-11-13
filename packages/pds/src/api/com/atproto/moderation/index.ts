import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import createReport from './createReport.js'

export default function (server: Server, ctx: AppContext) {
  createReport(server, ctx)
}

import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import createReport from './createReport.js'

export default function (server: Server, ctx: AppContext) {
  createReport(server, ctx)
}

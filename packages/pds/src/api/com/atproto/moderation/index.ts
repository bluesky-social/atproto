import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import createReport from './createReport'

export default function (server: Server, ctx: AppContext) {
  createReport(server, ctx)
}

import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import pds from './pds'

export default function (server: Server, ctx: AppContext) {
  pds(server, ctx)
}

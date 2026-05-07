import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import checkSignupQueue from './checkSignupQueue'

export default function (server: Server, ctx: AppContext) {
  checkSignupQueue(server, ctx)
}

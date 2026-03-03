import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import admin from './trustanchor/admin'
import deleteAccountWID from './trustanchor/deleteAccountWID'
import quicklogin from './trustanchor/quicklogin/xrpc-index'
import requestAccountDeleteWID from './trustanchor/requestAccountDeleteWID'

export default function (server: Server, ctx: AppContext) {
  admin(server, ctx)
  quicklogin(server, ctx)
  requestAccountDeleteWID(server, ctx)
  deleteAccountWID(server, ctx)
}

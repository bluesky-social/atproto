import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import createAccount from './create'
import createInviteCode from './createInviteCode'
import requestDelete from './requestDelete'
import deleteAccount from './delete'
import getAccount from './get'
import requestPasswordReset from './requestPasswordReset'
import resetPassword from './resetPassword'

export default function (server: Server, ctx: AppContext) {
  createAccount(server, ctx)
  createInviteCode(server, ctx)
  requestDelete(server, ctx)
  deleteAccount(server, ctx)
  getAccount(server, ctx)
  requestPasswordReset(server, ctx)
  resetPassword(server, ctx)
}

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

import describeServer from './describeServer'

import createAccount from './createAccount'
import createInviteCode from './createInviteCode'
import createInviteCodes from './createInviteCodes'
import getAccountInviteCodes from './getAccountInviteCodes'

import requestDelete from './requestAccountDelete'
import deleteAccount from './deleteAccount'

import requestPasswordReset from './requestPasswordReset'
import resetPassword from './resetPassword'

import createSession from './createSession'
import deleteSession from './deleteSession'
import getSession from './getSession'
import refreshSession from './refreshSession'

import createAppPassword from './createAppPassword'
import listAppPasswords from './listAppPasswords'
import revokeAppPassword from './revokeAppPassword'

export default function (server: Server, ctx: AppContext) {
  describeServer(server, ctx)
  createAccount(server, ctx)
  createInviteCode(server, ctx)
  createInviteCodes(server, ctx)
  getAccountInviteCodes(server, ctx)
  requestDelete(server, ctx)
  deleteAccount(server, ctx)
  requestPasswordReset(server, ctx)
  resetPassword(server, ctx)
  createSession(server, ctx)
  deleteSession(server, ctx)
  getSession(server, ctx)
  refreshSession(server, ctx)
  createAppPassword(server, ctx)
  listAppPasswords(server, ctx)
  revokeAppPassword(server, ctx)
}

import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import activateAccount from './activateAccount'
import checkAccountStatus from './checkAccountStatus'
import confirmEmail from './confirmEmail'
import createAccount from './createAccount'
import createAppPassword from './createAppPassword'
import createInviteCode from './createInviteCode'
import createInviteCodes from './createInviteCodes'
import createSession from './createSession'
import deactivateAccount from './deactivateAccount'
import deleteAccount from './deleteAccount'
import deleteSession from './deleteSession'
import describeServer from './describeServer'
import getAccountInviteCodes from './getAccountInviteCodes'
import getServiceAuth from './getServiceAuth'
import getSession from './getSession'
import listAppPasswords from './listAppPasswords'
import refreshSession from './refreshSession'
import requestDelete from './requestAccountDelete'
import requestEmailConfirmation from './requestEmailConfirmation'
import requestEmailUpdate from './requestEmailUpdate'
import requestPasswordReset from './requestPasswordReset'
import reserveSigningKey from './reserveSigningKey'
import resetPassword from './resetPassword'
import revokeAppPassword from './revokeAppPassword'
import updateEmail from './updateEmail'

export default function (server: Server, ctx: AppContext) {
  describeServer(server, ctx)
  createAccount(server, ctx)
  createInviteCode(server, ctx)
  createInviteCodes(server, ctx)
  getAccountInviteCodes(server, ctx)
  reserveSigningKey(server, ctx)
  requestDelete(server, ctx)
  deleteAccount(server, ctx)
  requestPasswordReset(server, ctx)
  resetPassword(server, ctx)
  requestEmailConfirmation(server, ctx)
  confirmEmail(server, ctx)
  requestEmailUpdate(server, ctx)
  updateEmail(server, ctx)
  createSession(server, ctx)
  deleteSession(server, ctx)
  getSession(server, ctx)
  refreshSession(server, ctx)
  createAppPassword(server, ctx)
  listAppPasswords(server, ctx)
  revokeAppPassword(server, ctx)
  getServiceAuth(server, ctx)
  checkAccountStatus(server, ctx)
  activateAccount(server, ctx)
  deactivateAccount(server, ctx)
}

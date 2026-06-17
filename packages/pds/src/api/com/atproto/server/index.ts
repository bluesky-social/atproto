import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import activateAccount from './activateAccount.js'
import checkAccountStatus from './checkAccountStatus.js'
import confirmEmail from './confirmEmail.js'
import createAccount from './createAccount.js'
import createAppPassword from './createAppPassword.js'
import createInviteCode from './createInviteCode.js'
import createInviteCodes from './createInviteCodes.js'
import createSession from './createSession.js'
import deactivateAccount from './deactivateAccount.js'
import deleteAccount from './deleteAccount.js'
import deleteSession from './deleteSession.js'
import describeServer from './describeServer.js'
import getAccountInviteCodes from './getAccountInviteCodes.js'
import getServiceAuth from './getServiceAuth.js'
import getSession from './getSession.js'
import listAppPasswords from './listAppPasswords.js'
import refreshSession from './refreshSession.js'
import requestDelete from './requestAccountDelete.js'
import requestEmailConfirmation from './requestEmailConfirmation.js'
import requestEmailUpdate from './requestEmailUpdate.js'
import requestPasswordReset from './requestPasswordReset.js'
import reserveSigningKey from './reserveSigningKey.js'
import resetPassword from './resetPassword.js'
import revokeAppPassword from './revokeAppPassword.js'
import updateEmail from './updateEmail.js'

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

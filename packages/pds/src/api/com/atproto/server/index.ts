import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

import describeServer from './describeServer'

import createAccount from './createAccount'
import createInviteCode from './createInviteCode'
import createInviteCodes from './createInviteCodes'
import getAccountInviteCodes from './getAccountInviteCodes'
import reserveSigningKey from './reserveSigningKey'

import requestDelete from './requestAccountDelete'
import deleteAccount from './deleteAccount'

import requestPasswordReset from './requestPasswordReset'
//import resetPassword from './resetPassword'

import requestEmailConfirmation from './requestEmailConfirmation'
import confirmEmail from './confirmEmail'

import requestEmailUpdate from './requestEmailUpdate'
import updateEmail from './updateEmail'

import createSession from './createSession'
import createSIWE from './createSIWE'
import deleteSession from './deleteSession'
import getSession from './getSession'
import refreshSession from './refreshSession'

import createAppPassword from './createAppPassword'
import listAppPasswords from './listAppPasswords'
import revokeAppPassword from './revokeAppPassword'

import getServiceAuth from './getServiceAuth'
import checkAccountStatus from './checkAccountStatus'
import activateAccount from './activateAccount'
import deactivateAccount from './deactivateAccount'

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
  //resetPassword(server, ctx)
  requestEmailConfirmation(server, ctx)
  confirmEmail(server, ctx)
  requestEmailUpdate(server, ctx)
  updateEmail(server, ctx)
  createSession(server, ctx)
  createSIWE(server, ctx)
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

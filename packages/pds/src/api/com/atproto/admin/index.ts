import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import deleteAccount from './deleteAccount.js'
import disableAccountInvites from './disableAccountInvites.js'
import disableInviteCodes from './disableInviteCodes.js'
import enableAccountInvites from './enableAccountInvites.js'
import getAccountInfo from './getAccountInfo.js'
import getAccountInfos from './getAccountInfos.js'
import getInviteCodes from './getInviteCodes.js'
import getSubjectStatus from './getSubjectStatus.js'
import sendEmail from './sendEmail.js'
import updateAccountEmail from './updateAccountEmail.js'
import updateAccountHandle from './updateAccountHandle.js'
import updateAccountPassword from './updateAccountPassword.js'
import updateSubjectStatus from './updateSubjectStatus.js'

export default function (server: Server, ctx: AppContext) {
  updateSubjectStatus(server, ctx)
  getSubjectStatus(server, ctx)
  getAccountInfo(server, ctx)
  getAccountInfos(server, ctx)
  enableAccountInvites(server, ctx)
  disableAccountInvites(server, ctx)
  disableInviteCodes(server, ctx)
  getInviteCodes(server, ctx)
  updateAccountHandle(server, ctx)
  updateAccountEmail(server, ctx)
  updateAccountPassword(server, ctx)
  sendEmail(server, ctx)
  deleteAccount(server, ctx)
}

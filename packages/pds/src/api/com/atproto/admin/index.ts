import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import updateSubjectStatus from './updateSubjectStatus'
import getSubjectStatus from './getSubjectStatus'
import getAccountInfo from './getAccountInfo'
import enableAccountInvites from './enableAccountInvites'
import disableAccountInvites from './disableAccountInvites'
import disableInviteCodes from './disableInviteCodes'
import getInviteCodes from './getInviteCodes'
import updateAccountHandle from './updateAccountHandle'
import updateAccountEmail from './updateAccountEmail'
import updateAccountPassword from './updateAccountPassword'
import sendEmail from './sendEmail'
import deleteAccount from './deleteAccount'
import getAccountInfos from './getAccountInfos'

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

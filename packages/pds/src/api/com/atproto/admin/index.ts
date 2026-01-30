import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import deleteAccount from './deleteAccount'
import disableAccountInvites from './disableAccountInvites'
import disableInviteCodes from './disableInviteCodes'
import enableAccountInvites from './enableAccountInvites'
import getAccountInfo from './getAccountInfo'
import getAccountInfos from './getAccountInfos'
import getInviteCodes from './getInviteCodes'
import getNeuroLink from './getNeuroLink'
import getSubjectStatus from './getSubjectStatus'
import listNeuroAccounts from './listNeuroAccounts'
import sendEmail from './sendEmail'
import updateAccountEmail from './updateAccountEmail'
import updateAccountHandle from './updateAccountHandle'
import updateAccountPassword from './updateAccountPassword'
import updateNeuroLink from './updateNeuroLink'
import updateSubjectStatus from './updateSubjectStatus'

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
  getNeuroLink(server, ctx)
  listNeuroAccounts(server, ctx)
  updateNeuroLink(server, ctx)
}

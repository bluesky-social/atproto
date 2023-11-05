import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import resolveModerationReports from './resolveModerationReports'
import reverseModerationAction from './reverseModerationAction'
import takeModerationAction from './takeModerationAction'
import updateSubjectStatus from './updateSubjectStatus'
import getSubjectStatus from './getSubjectStatus'
import getAccountInfo from './getAccountInfo'
import searchRepos from './searchRepos'
import getRecord from './getRecord'
import getRepo from './getRepo'
import getModerationAction from './getModerationAction'
import getModerationActions from './getModerationActions'
import getModerationReport from './getModerationReport'
import getModerationReports from './getModerationReports'
import enableAccountInvites from './enableAccountInvites'
import disableAccountInvites from './disableAccountInvites'
import disableInviteCodes from './disableInviteCodes'
import getInviteCodes from './getInviteCodes'
import updateAccountHandle from './updateAccountHandle'
import updateAccountEmail from './updateAccountEmail'
import sendEmail from './sendEmail'
import deleteAccount from './deleteAccount'

export default function (server: Server, ctx: AppContext) {
  resolveModerationReports(server, ctx)
  reverseModerationAction(server, ctx)
  takeModerationAction(server, ctx)
  updateSubjectStatus(server, ctx)
  getSubjectStatus(server, ctx)
  getAccountInfo(server, ctx)
  searchRepos(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getModerationAction(server, ctx)
  getModerationActions(server, ctx)
  getModerationReport(server, ctx)
  getModerationReports(server, ctx)
  enableAccountInvites(server, ctx)
  disableAccountInvites(server, ctx)
  disableInviteCodes(server, ctx)
  getInviteCodes(server, ctx)
  updateAccountHandle(server, ctx)
  updateAccountEmail(server, ctx)
  sendEmail(server, ctx)
  deleteAccount(server, ctx)
}

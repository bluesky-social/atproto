import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import takeModerationAction from './takeModerationAction'
import searchRepos from './searchRepos'
import getRecord from './getRecord'
import getRepo from './getRepo'
import getModerationAction from './getModerationAction'
import getModerationEvents from './getModerationEvents'
import getModerationReport from './getModerationReport'
import getModerationReports from './getModerationReports'
import enableAccountInvites from './enableAccountInvites'
import disableAccountInvites from './disableAccountInvites'
import disableInviteCodes from './disableInviteCodes'
import getInviteCodes from './getInviteCodes'
import updateAccountHandle from './updateAccountHandle'
import updateAccountEmail from './updateAccountEmail'
import sendEmail from './sendEmail'

export default function (server: Server, ctx: AppContext) {
  takeModerationAction(server, ctx)
  searchRepos(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getModerationAction(server, ctx)
  getModerationEvents(server, ctx)
  getModerationReport(server, ctx)
  getModerationReports(server, ctx)
  enableAccountInvites(server, ctx)
  disableAccountInvites(server, ctx)
  disableInviteCodes(server, ctx)
  getInviteCodes(server, ctx)
  updateAccountHandle(server, ctx)
  updateAccountEmail(server, ctx)
  sendEmail(server, ctx)
}

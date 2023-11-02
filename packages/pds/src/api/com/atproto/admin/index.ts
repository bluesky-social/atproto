import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import emitModerationEvent from './emitModerationEvent'
import searchRepos from './searchRepos'
import getRecord from './getRecord'
import getRepo from './getRepo'
import getModerationEvent from './getModerationEvent'
import getModerationEvents from './getModerationEvents'
import enableAccountInvites from './enableAccountInvites'
import disableAccountInvites from './disableAccountInvites'
import disableInviteCodes from './disableInviteCodes'
import getInviteCodes from './getInviteCodes'
import updateAccountHandle from './updateAccountHandle'
import updateAccountEmail from './updateAccountEmail'
import sendEmail from './sendEmail'
import getModerationStatuses from './getModerationStatuses'

export default function (server: Server, ctx: AppContext) {
  emitModerationEvent(server, ctx)
  searchRepos(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getModerationEvent(server, ctx)
  getModerationEvents(server, ctx)
  getModerationStatuses(server, ctx)
  enableAccountInvites(server, ctx)
  disableAccountInvites(server, ctx)
  disableInviteCodes(server, ctx)
  getInviteCodes(server, ctx)
  updateAccountHandle(server, ctx)
  updateAccountEmail(server, ctx)
  sendEmail(server, ctx)
}

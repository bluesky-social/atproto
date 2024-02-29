import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import emitModerationEvent from '../../../tools/ozone/emitModerationEvent'
import updateSubjectStatus from './updateSubjectStatus'
import getSubjectStatus from './getSubjectStatus'
import getAccountInfo from './getAccountInfo'
import searchRepos from './searchRepos'
import getRecord from './getRecord'
import getRepo from './getRepo'
import getModerationEvent from '../../../tools/ozone/getModerationEvent'
import queryModerationEvents from '../../../tools/ozone/queryModerationEvents'
import enableAccountInvites from './enableAccountInvites'
import disableAccountInvites from './disableAccountInvites'
import disableInviteCodes from './disableInviteCodes'
import getInviteCodes from './getInviteCodes'
import updateAccountHandle from './updateAccountHandle'
import updateAccountEmail from './updateAccountEmail'
import updateAccountPassword from './updateAccountPassword'
import sendEmail from './sendEmail'
import deleteAccount from './deleteAccount'
import queryModerationStatuses from '../../../tools/ozone/queryModerationStatuses'
import createCommunicationTemplate from '../../../tools/ozone/createCommunicationTemplate'
import deleteCommunicationTemplate from '../../../tools/ozone/deleteCommunicationTemplate'
import updateCommunicationTemplate from '../../../tools/ozone/updateCommunicationTemplate'
import listCommunicationTemplates from '../../../tools/ozone/listCommunicationTemplates'

export default function (server: Server, ctx: AppContext) {
  emitModerationEvent(server, ctx)
  updateSubjectStatus(server, ctx)
  getSubjectStatus(server, ctx)
  getAccountInfo(server, ctx)
  searchRepos(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getModerationEvent(server, ctx)
  queryModerationEvents(server, ctx)
  queryModerationStatuses(server, ctx)
  enableAccountInvites(server, ctx)
  disableAccountInvites(server, ctx)
  disableInviteCodes(server, ctx)
  getInviteCodes(server, ctx)
  updateAccountHandle(server, ctx)
  updateAccountEmail(server, ctx)
  updateAccountPassword(server, ctx)
  sendEmail(server, ctx)
  deleteAccount(server, ctx)
  listCommunicationTemplates(server, ctx)
  createCommunicationTemplate(server, ctx)
  updateCommunicationTemplate(server, ctx)
  deleteCommunicationTemplate(server, ctx)
}

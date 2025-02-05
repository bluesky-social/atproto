import { AppContext } from '../context'
import { Server } from '../lexicon'

import chat from './chat'
import createTemplate from './communication/createTemplate'
import deleteTemplate from './communication/deleteTemplate'
import listTemplates from './communication/listTemplates'
import updateTemplate from './communication/updateTemplate'
import fetchLabels from './label/fetchLabels'
import queryLabels from './label/queryLabels'
import subscribeLabels from './label/subscribeLabels'
import emitEvent from './moderation/emitEvent'
import getEvent from './moderation/getEvent'
import adminGetRecord from './moderation/getRecord'
import adminGetRecords from './moderation/getRecords'
import getRepo from './moderation/getRepo'
import getRepos from './moderation/getRepos'
import queryEvents from './moderation/queryEvents'
import queryStatuses from './moderation/queryStatuses'
import searchRepos from './moderation/searchRepos'
import proxied from './proxied'
import createReport from './report/createReport'
import getConfig from './server/getConfig'
import setAddValues from './set/addValues'
import deleteSet from './set/deleteSet'
import setDeleteValues from './set/deleteValues'
import setGetValues from './set/getValues'
import querySets from './set/querySets'
import upsertSet from './set/upsertSet'
import listOptions from './setting/listOptions'
import removeOptions from './setting/removeOptions'
import upsertOption from './setting/upsertOption'
import addMember from './team/addMember'
import deleteMember from './team/deleteMember'
import listMembers from './team/listMembers'
import updateMember from './team/updateMember'

export * as health from './health'

export * as wellKnown from './well-known'

export default function (server: Server, ctx: AppContext) {
  createReport(server, ctx)
  emitEvent(server, ctx)
  searchRepos(server, ctx)
  adminGetRecord(server, ctx)
  adminGetRecords(server, ctx)
  getRepo(server, ctx)
  getRepos(server, ctx)
  getEvent(server, ctx)
  queryEvents(server, ctx)
  queryStatuses(server, ctx)
  queryLabels(server, ctx)
  subscribeLabels(server, ctx)
  fetchLabels(server, ctx)
  listTemplates(server, ctx)
  createTemplate(server, ctx)
  updateTemplate(server, ctx)
  deleteTemplate(server, ctx)
  listMembers(server, ctx)
  addMember(server, ctx)
  updateMember(server, ctx)
  deleteMember(server, ctx)
  chat(server, ctx)
  proxied(server, ctx)
  getConfig(server, ctx)
  setAddValues(server, ctx)
  setGetValues(server, ctx)
  querySets(server, ctx)
  upsertSet(server, ctx)
  setDeleteValues(server, ctx)
  deleteSet(server, ctx)
  upsertOption(server, ctx)
  listOptions(server, ctx)
  removeOptions(server, ctx)
  return server
}

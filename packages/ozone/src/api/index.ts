import { AppContext } from '../context.js'
import { Server } from '../lexicon/index.js'
import chat from './chat/index.js'
import createTemplate from './communication/createTemplate.js'
import deleteTemplate from './communication/deleteTemplate.js'
import listTemplates from './communication/listTemplates.js'
import updateTemplate from './communication/updateTemplate.js'
import fetchLabels from './label/fetchLabels.js'
import queryLabels from './label/queryLabels.js'
import subscribeLabels from './label/subscribeLabels.js'
import cancelScheduledActions from './moderation/cancelScheduledActions.js'
import emitEvent from './moderation/emitEvent.js'
import getAccountTimeline from './moderation/getAccountTimeline.js'
import getEvent from './moderation/getEvent.js'
import adminGetRecord from './moderation/getRecord.js'
import adminGetRecords from './moderation/getRecords.js'
import getRepo from './moderation/getRepo.js'
import getReporterStats from './moderation/getReporterStats.js'
import getRepos from './moderation/getRepos.js'
import getSubjects from './moderation/getSubjects.js'
import listScheduledActions from './moderation/listScheduledActions.js'
import queryEvents from './moderation/queryEvents.js'
import queryStatuses from './moderation/queryStatuses.js'
import scheduleAction from './moderation/scheduleAction.js'
import searchRepos from './moderation/searchRepos.js'
import proxied from './proxied.js'
import assignQueueModerator from './queue/assignModerator.js'
import createQueue from './queue/createQueue.js'
import deleteQueue from './queue/deleteQueue.js'
import getQueueAssignments from './queue/getAssignments.js'
import listQueues from './queue/listQueues.js'
import routeReports from './queue/routeReports.js'
import unassignQueueModerator from './queue/unassignModerator.js'
import updateQueue from './queue/updateQueue.js'
import assignReportModerator from './report/assignModerator.js'
import createActivity from './report/createActivity.js'
import createReport from './report/createReport.js'
import getReportAssignments from './report/getAssignments.js'
import getHistoricalStats from './report/getHistoricalStats.js'
import getLatestReport from './report/getLatestReport.js'
import getLiveStats from './report/getLiveStats.js'
import getReport from './report/getReport.js'
import listActivities from './report/listActivities.js'
import queryActivities from './report/queryActivities.js'
import queryReports from './report/queryReports.js'
import reassignQueue from './report/reassignQueue.js'
import refreshStats from './report/refreshStats.js'
import unassignReportModerator from './report/unassignModerator.js'
import addSafelinkRule from './safelink/addRule.js'
import querySafelinkEvents from './safelink/queryEvents.js'
import querySafelinkRules from './safelink/queryRules.js'
import removeSafelinkRule from './safelink/removeRule.js'
import updateSafelinkRule from './safelink/updateRule.js'
import getConfig from './server/getConfig.js'
import setAddValues from './set/addValues.js'
import deleteSet from './set/deleteSet.js'
import setDeleteValues from './set/deleteValues.js'
import setGetValues from './set/getValues.js'
import querySets from './set/querySets.js'
import upsertSet from './set/upsertSet.js'
import listOptions from './setting/listOptions.js'
import removeOptions from './setting/removeOptions.js'
import upsertOption from './setting/upsertOption.js'
import addMember from './team/addMember.js'
import deleteMember from './team/deleteMember.js'
import listMembers from './team/listMembers.js'
import updateMember from './team/updateMember.js'
import grantVerifications from './verification/grantVerifications.js'
import listVerifications from './verification/listVerifications.js'
import revokeVerifications from './verification/revokeVerifications.js'

export * as health from './health.js'

export * as wellKnown from './well-known.js'

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
  getReport(server, ctx)
  queryReports(server, ctx)
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
  createQueue(server, ctx)
  listQueues(server, ctx)
  updateQueue(server, ctx)
  deleteQueue(server, ctx)
  setAddValues(server, ctx)
  setGetValues(server, ctx)
  querySets(server, ctx)
  upsertSet(server, ctx)
  setDeleteValues(server, ctx)
  deleteSet(server, ctx)
  upsertOption(server, ctx)
  listOptions(server, ctx)
  removeOptions(server, ctx)
  getReporterStats(server, ctx)
  getSubjects(server, ctx)
  grantVerifications(server, ctx)
  revokeVerifications(server, ctx)
  listVerifications(server, ctx)
  addSafelinkRule(server, ctx)
  updateSafelinkRule(server, ctx)
  removeSafelinkRule(server, ctx)
  querySafelinkEvents(server, ctx)
  querySafelinkRules(server, ctx)
  getAccountTimeline(server, ctx)
  scheduleAction(server, ctx)
  listScheduledActions(server, ctx)
  cancelScheduledActions(server, ctx)
  routeReports(server, ctx)
  getLiveStats(server, ctx)
  getHistoricalStats(server, ctx)
  refreshStats(server, ctx)
  assignQueueModerator(server, ctx)
  unassignQueueModerator(server, ctx)
  getQueueAssignments(server, ctx)
  getLatestReport(server, ctx)
  assignReportModerator(server, ctx)
  unassignReportModerator(server, ctx)
  getReportAssignments(server, ctx)
  createActivity(server, ctx)
  listActivities(server, ctx)
  queryActivities(server, ctx)
  reassignQueue(server, ctx)
  return server
}

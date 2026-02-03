/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server'
import { schemas } from './lexicons.js'
import * as AppBskyActorGetPreferences from './types/app/bsky/actor/getPreferences.js'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile.js'
import * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles.js'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions.js'
import * as AppBskyActorPutPreferences from './types/app/bsky/actor/putPreferences.js'
import * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors.js'
import * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead.js'
import * as AppBskyAgeassuranceBegin from './types/app/bsky/ageassurance/begin.js'
import * as AppBskyAgeassuranceGetConfig from './types/app/bsky/ageassurance/getConfig.js'
import * as AppBskyAgeassuranceGetState from './types/app/bsky/ageassurance/getState.js'
import * as AppBskyBookmarkCreateBookmark from './types/app/bsky/bookmark/createBookmark.js'
import * as AppBskyBookmarkDeleteBookmark from './types/app/bsky/bookmark/deleteBookmark.js'
import * as AppBskyBookmarkGetBookmarks from './types/app/bsky/bookmark/getBookmarks.js'
import * as AppBskyContactDismissMatch from './types/app/bsky/contact/dismissMatch.js'
import * as AppBskyContactGetMatches from './types/app/bsky/contact/getMatches.js'
import * as AppBskyContactGetSyncStatus from './types/app/bsky/contact/getSyncStatus.js'
import * as AppBskyContactImportContacts from './types/app/bsky/contact/importContacts.js'
import * as AppBskyContactRemoveData from './types/app/bsky/contact/removeData.js'
import * as AppBskyContactSendNotification from './types/app/bsky/contact/sendNotification.js'
import * as AppBskyContactStartPhoneVerification from './types/app/bsky/contact/startPhoneVerification.js'
import * as AppBskyContactVerifyPhone from './types/app/bsky/contact/verifyPhone.js'
import * as AppBskyDraftCreateDraft from './types/app/bsky/draft/createDraft.js'
import * as AppBskyDraftDeleteDraft from './types/app/bsky/draft/deleteDraft.js'
import * as AppBskyDraftGetDrafts from './types/app/bsky/draft/getDrafts.js'
import * as AppBskyDraftUpdateDraft from './types/app/bsky/draft/updateDraft.js'
import * as AppBskyFeedDescribeFeedGenerator from './types/app/bsky/feed/describeFeedGenerator.js'
import * as AppBskyFeedGetActorFeeds from './types/app/bsky/feed/getActorFeeds.js'
import * as AppBskyFeedGetActorLikes from './types/app/bsky/feed/getActorLikes.js'
import * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed.js'
import * as AppBskyFeedGetFeed from './types/app/bsky/feed/getFeed.js'
import * as AppBskyFeedGetFeedGenerator from './types/app/bsky/feed/getFeedGenerator.js'
import * as AppBskyFeedGetFeedGenerators from './types/app/bsky/feed/getFeedGenerators.js'
import * as AppBskyFeedGetFeedSkeleton from './types/app/bsky/feed/getFeedSkeleton.js'
import * as AppBskyFeedGetLikes from './types/app/bsky/feed/getLikes.js'
import * as AppBskyFeedGetListFeed from './types/app/bsky/feed/getListFeed.js'
import * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread.js'
import * as AppBskyFeedGetPosts from './types/app/bsky/feed/getPosts.js'
import * as AppBskyFeedGetQuotes from './types/app/bsky/feed/getQuotes.js'
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy.js'
import * as AppBskyFeedGetSuggestedFeeds from './types/app/bsky/feed/getSuggestedFeeds.js'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline.js'
import * as AppBskyFeedSearchPosts from './types/app/bsky/feed/searchPosts.js'
import * as AppBskyFeedSendInteractions from './types/app/bsky/feed/sendInteractions.js'
import * as AppBskyGraphGetActorStarterPacks from './types/app/bsky/graph/getActorStarterPacks.js'
import * as AppBskyGraphGetBlocks from './types/app/bsky/graph/getBlocks.js'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers.js'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows.js'
import * as AppBskyGraphGetKnownFollowers from './types/app/bsky/graph/getKnownFollowers.js'
import * as AppBskyGraphGetList from './types/app/bsky/graph/getList.js'
import * as AppBskyGraphGetListBlocks from './types/app/bsky/graph/getListBlocks.js'
import * as AppBskyGraphGetListMutes from './types/app/bsky/graph/getListMutes.js'
import * as AppBskyGraphGetLists from './types/app/bsky/graph/getLists.js'
import * as AppBskyGraphGetListsWithMembership from './types/app/bsky/graph/getListsWithMembership.js'
import * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes.js'
import * as AppBskyGraphGetRelationships from './types/app/bsky/graph/getRelationships.js'
import * as AppBskyGraphGetStarterPack from './types/app/bsky/graph/getStarterPack.js'
import * as AppBskyGraphGetStarterPacks from './types/app/bsky/graph/getStarterPacks.js'
import * as AppBskyGraphGetStarterPacksWithMembership from './types/app/bsky/graph/getStarterPacksWithMembership.js'
import * as AppBskyGraphGetSuggestedFollowsByActor from './types/app/bsky/graph/getSuggestedFollowsByActor.js'
import * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor.js'
import * as AppBskyGraphMuteActorList from './types/app/bsky/graph/muteActorList.js'
import * as AppBskyGraphMuteThread from './types/app/bsky/graph/muteThread.js'
import * as AppBskyGraphSearchStarterPacks from './types/app/bsky/graph/searchStarterPacks.js'
import * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor.js'
import * as AppBskyGraphUnmuteActorList from './types/app/bsky/graph/unmuteActorList.js'
import * as AppBskyGraphUnmuteThread from './types/app/bsky/graph/unmuteThread.js'
import * as AppBskyLabelerGetServices from './types/app/bsky/labeler/getServices.js'
import * as AppBskyNotificationGetPreferences from './types/app/bsky/notification/getPreferences.js'
import * as AppBskyNotificationGetUnreadCount from './types/app/bsky/notification/getUnreadCount.js'
import * as AppBskyNotificationListActivitySubscriptions from './types/app/bsky/notification/listActivitySubscriptions.js'
import * as AppBskyNotificationListNotifications from './types/app/bsky/notification/listNotifications.js'
import * as AppBskyNotificationPutActivitySubscription from './types/app/bsky/notification/putActivitySubscription.js'
import * as AppBskyNotificationPutPreferences from './types/app/bsky/notification/putPreferences.js'
import * as AppBskyNotificationPutPreferencesV2 from './types/app/bsky/notification/putPreferencesV2.js'
import * as AppBskyNotificationRegisterPush from './types/app/bsky/notification/registerPush.js'
import * as AppBskyNotificationUnregisterPush from './types/app/bsky/notification/unregisterPush.js'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen.js'
import * as AppBskyUnspeccedGetAgeAssuranceState from './types/app/bsky/unspecced/getAgeAssuranceState.js'
import * as AppBskyUnspeccedGetConfig from './types/app/bsky/unspecced/getConfig.js'
import * as AppBskyUnspeccedGetOnboardingSuggestedStarterPacks from './types/app/bsky/unspecced/getOnboardingSuggestedStarterPacks.js'
import * as AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton from './types/app/bsky/unspecced/getOnboardingSuggestedStarterPacksSkeleton.js'
import * as AppBskyUnspeccedGetPopularFeedGenerators from './types/app/bsky/unspecced/getPopularFeedGenerators.js'
import * as AppBskyUnspeccedGetPostThreadOtherV2 from './types/app/bsky/unspecced/getPostThreadOtherV2.js'
import * as AppBskyUnspeccedGetPostThreadV2 from './types/app/bsky/unspecced/getPostThreadV2.js'
import * as AppBskyUnspeccedGetSuggestedFeeds from './types/app/bsky/unspecced/getSuggestedFeeds.js'
import * as AppBskyUnspeccedGetSuggestedFeedsSkeleton from './types/app/bsky/unspecced/getSuggestedFeedsSkeleton.js'
import * as AppBskyUnspeccedGetSuggestedStarterPacks from './types/app/bsky/unspecced/getSuggestedStarterPacks.js'
import * as AppBskyUnspeccedGetSuggestedStarterPacksSkeleton from './types/app/bsky/unspecced/getSuggestedStarterPacksSkeleton.js'
import * as AppBskyUnspeccedGetSuggestedUsers from './types/app/bsky/unspecced/getSuggestedUsers.js'
import * as AppBskyUnspeccedGetSuggestedUsersSkeleton from './types/app/bsky/unspecced/getSuggestedUsersSkeleton.js'
import * as AppBskyUnspeccedGetSuggestionsSkeleton from './types/app/bsky/unspecced/getSuggestionsSkeleton.js'
import * as AppBskyUnspeccedGetTaggedSuggestions from './types/app/bsky/unspecced/getTaggedSuggestions.js'
import * as AppBskyUnspeccedGetTrendingTopics from './types/app/bsky/unspecced/getTrendingTopics.js'
import * as AppBskyUnspeccedGetTrends from './types/app/bsky/unspecced/getTrends.js'
import * as AppBskyUnspeccedGetTrendsSkeleton from './types/app/bsky/unspecced/getTrendsSkeleton.js'
import * as AppBskyUnspeccedInitAgeAssurance from './types/app/bsky/unspecced/initAgeAssurance.js'
import * as AppBskyUnspeccedSearchActorsSkeleton from './types/app/bsky/unspecced/searchActorsSkeleton.js'
import * as AppBskyUnspeccedSearchPostsSkeleton from './types/app/bsky/unspecced/searchPostsSkeleton.js'
import * as AppBskyUnspeccedSearchStarterPacksSkeleton from './types/app/bsky/unspecced/searchStarterPacksSkeleton.js'
import * as AppBskyVideoGetJobStatus from './types/app/bsky/video/getJobStatus.js'
import * as AppBskyVideoGetUploadLimits from './types/app/bsky/video/getUploadLimits.js'
import * as AppBskyVideoUploadVideo from './types/app/bsky/video/uploadVideo.js'
import * as ChatBskyActorDeleteAccount from './types/chat/bsky/actor/deleteAccount.js'
import * as ChatBskyActorExportAccountData from './types/chat/bsky/actor/exportAccountData.js'
import * as ChatBskyConvoAcceptConvo from './types/chat/bsky/convo/acceptConvo.js'
import * as ChatBskyConvoAddReaction from './types/chat/bsky/convo/addReaction.js'
import * as ChatBskyConvoDeleteMessageForSelf from './types/chat/bsky/convo/deleteMessageForSelf.js'
import * as ChatBskyConvoGetConvo from './types/chat/bsky/convo/getConvo.js'
import * as ChatBskyConvoGetConvoAvailability from './types/chat/bsky/convo/getConvoAvailability.js'
import * as ChatBskyConvoGetConvoForMembers from './types/chat/bsky/convo/getConvoForMembers.js'
import * as ChatBskyConvoGetLog from './types/chat/bsky/convo/getLog.js'
import * as ChatBskyConvoGetMessages from './types/chat/bsky/convo/getMessages.js'
import * as ChatBskyConvoLeaveConvo from './types/chat/bsky/convo/leaveConvo.js'
import * as ChatBskyConvoListConvos from './types/chat/bsky/convo/listConvos.js'
import * as ChatBskyConvoMuteConvo from './types/chat/bsky/convo/muteConvo.js'
import * as ChatBskyConvoRemoveReaction from './types/chat/bsky/convo/removeReaction.js'
import * as ChatBskyConvoSendMessage from './types/chat/bsky/convo/sendMessage.js'
import * as ChatBskyConvoSendMessageBatch from './types/chat/bsky/convo/sendMessageBatch.js'
import * as ChatBskyConvoUnmuteConvo from './types/chat/bsky/convo/unmuteConvo.js'
import * as ChatBskyConvoUpdateAllRead from './types/chat/bsky/convo/updateAllRead.js'
import * as ChatBskyConvoUpdateRead from './types/chat/bsky/convo/updateRead.js'
import * as ChatBskyModerationGetActorMetadata from './types/chat/bsky/moderation/getActorMetadata.js'
import * as ChatBskyModerationGetMessageContext from './types/chat/bsky/moderation/getMessageContext.js'
import * as ChatBskyModerationUpdateActorAccess from './types/chat/bsky/moderation/updateActorAccess.js'
import * as ComAtprotoAdminDeleteAccount from './types/com/atproto/admin/deleteAccount.js'
import * as ComAtprotoAdminDisableAccountInvites from './types/com/atproto/admin/disableAccountInvites.js'
import * as ComAtprotoAdminDisableInviteCodes from './types/com/atproto/admin/disableInviteCodes.js'
import * as ComAtprotoAdminEnableAccountInvites from './types/com/atproto/admin/enableAccountInvites.js'
import * as ComAtprotoAdminGetAccountInfo from './types/com/atproto/admin/getAccountInfo.js'
import * as ComAtprotoAdminGetAccountInfos from './types/com/atproto/admin/getAccountInfos.js'
import * as ComAtprotoAdminGetInviteCodes from './types/com/atproto/admin/getInviteCodes.js'
import * as ComAtprotoAdminGetNeuroLink from './types/com/atproto/admin/getNeuroLink.js'
import * as ComAtprotoAdminGetSubjectStatus from './types/com/atproto/admin/getSubjectStatus.js'
import * as ComAtprotoAdminImportAccount from './types/com/atproto/admin/importAccount.js'
import * as ComAtprotoAdminListNeuroAccounts from './types/com/atproto/admin/listNeuroAccounts.js'
import * as ComAtprotoAdminMigrateAccount from './types/com/atproto/admin/migrateAccount.js'
import * as ComAtprotoAdminSearchAccounts from './types/com/atproto/admin/searchAccounts.js'
import * as ComAtprotoAdminSendEmail from './types/com/atproto/admin/sendEmail.js'
import * as ComAtprotoAdminUpdateAccountEmail from './types/com/atproto/admin/updateAccountEmail.js'
import * as ComAtprotoAdminUpdateAccountHandle from './types/com/atproto/admin/updateAccountHandle.js'
import * as ComAtprotoAdminUpdateAccountPassword from './types/com/atproto/admin/updateAccountPassword.js'
import * as ComAtprotoAdminUpdateAccountSigningKey from './types/com/atproto/admin/updateAccountSigningKey.js'
import * as ComAtprotoAdminUpdateNeuroLink from './types/com/atproto/admin/updateNeuroLink.js'
import * as ComAtprotoAdminUpdateSubjectStatus from './types/com/atproto/admin/updateSubjectStatus.js'
import * as ComAtprotoAdminValidateMigrationTarget from './types/com/atproto/admin/validateMigrationTarget.js'
import * as ComAtprotoIdentityGetRecommendedDidCredentials from './types/com/atproto/identity/getRecommendedDidCredentials.js'
import * as ComAtprotoIdentityRefreshIdentity from './types/com/atproto/identity/refreshIdentity.js'
import * as ComAtprotoIdentityRequestPlcOperationSignature from './types/com/atproto/identity/requestPlcOperationSignature.js'
import * as ComAtprotoIdentityResolveDid from './types/com/atproto/identity/resolveDid.js'
import * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle.js'
import * as ComAtprotoIdentityResolveIdentity from './types/com/atproto/identity/resolveIdentity.js'
import * as ComAtprotoIdentitySignPlcOperation from './types/com/atproto/identity/signPlcOperation.js'
import * as ComAtprotoIdentitySubmitPlcOperation from './types/com/atproto/identity/submitPlcOperation.js'
import * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle.js'
import * as ComAtprotoLabelQueryLabels from './types/com/atproto/label/queryLabels.js'
import * as ComAtprotoLabelSubscribeLabels from './types/com/atproto/label/subscribeLabels.js'
import * as ComAtprotoLexiconResolveLexicon from './types/com/atproto/lexicon/resolveLexicon.js'
import * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport.js'
import * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites.js'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo.js'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo.js'
import * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs.js'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord.js'
import * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob.js'
import * as ComAtprotoServerActivateAccount from './types/com/atproto/server/activateAccount.js'
import * as ComAtprotoServerCheckAccountStatus from './types/com/atproto/server/checkAccountStatus.js'
import * as ComAtprotoServerConfirmEmail from './types/com/atproto/server/confirmEmail.js'
import * as ComAtprotoServerCreateAccount from './types/com/atproto/server/createAccount.js'
import * as ComAtprotoServerCreateAppPassword from './types/com/atproto/server/createAppPassword.js'
import * as ComAtprotoServerCreateInviteCode from './types/com/atproto/server/createInviteCode.js'
import * as ComAtprotoServerCreateInviteCodes from './types/com/atproto/server/createInviteCodes.js'
import * as ComAtprotoServerCreateSession from './types/com/atproto/server/createSession.js'
import * as ComAtprotoServerDeactivateAccount from './types/com/atproto/server/deactivateAccount.js'
import * as ComAtprotoServerDeleteAccount from './types/com/atproto/server/deleteAccount.js'
import * as ComAtprotoServerDeleteSession from './types/com/atproto/server/deleteSession.js'
import * as ComAtprotoServerDescribeServer from './types/com/atproto/server/describeServer.js'
import * as ComAtprotoServerGetAccountInviteCodes from './types/com/atproto/server/getAccountInviteCodes.js'
import * as ComAtprotoServerGetServiceAuth from './types/com/atproto/server/getServiceAuth.js'
import * as ComAtprotoServerGetSession from './types/com/atproto/server/getSession.js'
import * as ComAtprotoServerListAppPasswords from './types/com/atproto/server/listAppPasswords.js'
import * as ComAtprotoServerRefreshSession from './types/com/atproto/server/refreshSession.js'
import * as ComAtprotoServerRequestAccountDelete from './types/com/atproto/server/requestAccountDelete.js'
import * as ComAtprotoServerRequestEmailConfirmation from './types/com/atproto/server/requestEmailConfirmation.js'
import * as ComAtprotoServerRequestEmailUpdate from './types/com/atproto/server/requestEmailUpdate.js'
import * as ComAtprotoServerRequestPasswordReset from './types/com/atproto/server/requestPasswordReset.js'
import * as ComAtprotoServerReserveSigningKey from './types/com/atproto/server/reserveSigningKey.js'
import * as ComAtprotoServerResetPassword from './types/com/atproto/server/resetPassword.js'
import * as ComAtprotoServerRevokeAppPassword from './types/com/atproto/server/revokeAppPassword.js'
import * as ComAtprotoServerUpdateEmail from './types/com/atproto/server/updateEmail.js'
import * as ComAtprotoSyncGetBlob from './types/com/atproto/sync/getBlob.js'
import * as ComAtprotoSyncGetBlocks from './types/com/atproto/sync/getBlocks.js'
import * as ComAtprotoSyncGetCheckout from './types/com/atproto/sync/getCheckout.js'
import * as ComAtprotoSyncGetHead from './types/com/atproto/sync/getHead.js'
import * as ComAtprotoSyncGetHostStatus from './types/com/atproto/sync/getHostStatus.js'
import * as ComAtprotoSyncGetLatestCommit from './types/com/atproto/sync/getLatestCommit.js'
import * as ComAtprotoSyncGetRecord from './types/com/atproto/sync/getRecord.js'
import * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo.js'
import * as ComAtprotoSyncGetRepoStatus from './types/com/atproto/sync/getRepoStatus.js'
import * as ComAtprotoSyncListBlobs from './types/com/atproto/sync/listBlobs.js'
import * as ComAtprotoSyncListHosts from './types/com/atproto/sync/listHosts.js'
import * as ComAtprotoSyncListRepos from './types/com/atproto/sync/listRepos.js'
import * as ComAtprotoSyncListReposByCollection from './types/com/atproto/sync/listReposByCollection.js'
import * as ComAtprotoSyncNotifyOfUpdate from './types/com/atproto/sync/notifyOfUpdate.js'
import * as ComAtprotoSyncRequestCrawl from './types/com/atproto/sync/requestCrawl.js'
import * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos.js'
import * as ComAtprotoTempAddReservedHandle from './types/com/atproto/temp/addReservedHandle.js'
import * as ComAtprotoTempCheckHandleAvailability from './types/com/atproto/temp/checkHandleAvailability.js'
import * as ComAtprotoTempCheckSignupQueue from './types/com/atproto/temp/checkSignupQueue.js'
import * as ComAtprotoTempDereferenceScope from './types/com/atproto/temp/dereferenceScope.js'
import * as ComAtprotoTempFetchLabels from './types/com/atproto/temp/fetchLabels.js'
import * as ComAtprotoTempRequestPhoneVerification from './types/com/atproto/temp/requestPhoneVerification.js'
import * as ComAtprotoTempRevokeAccountCredentials from './types/com/atproto/temp/revokeAccountCredentials.js'

export const APP_BSKY_ACTOR = {
  StatusLive: 'app.bsky.actor.status#live',
}
export const APP_BSKY_FEED = {
  DefsRequestLess: 'app.bsky.feed.defs#requestLess',
  DefsRequestMore: 'app.bsky.feed.defs#requestMore',
  DefsClickthroughItem: 'app.bsky.feed.defs#clickthroughItem',
  DefsClickthroughAuthor: 'app.bsky.feed.defs#clickthroughAuthor',
  DefsClickthroughReposter: 'app.bsky.feed.defs#clickthroughReposter',
  DefsClickthroughEmbed: 'app.bsky.feed.defs#clickthroughEmbed',
  DefsContentModeUnspecified: 'app.bsky.feed.defs#contentModeUnspecified',
  DefsContentModeVideo: 'app.bsky.feed.defs#contentModeVideo',
  DefsInteractionSeen: 'app.bsky.feed.defs#interactionSeen',
  DefsInteractionLike: 'app.bsky.feed.defs#interactionLike',
  DefsInteractionRepost: 'app.bsky.feed.defs#interactionRepost',
  DefsInteractionReply: 'app.bsky.feed.defs#interactionReply',
  DefsInteractionQuote: 'app.bsky.feed.defs#interactionQuote',
  DefsInteractionShare: 'app.bsky.feed.defs#interactionShare',
}
export const APP_BSKY_GRAPH = {
  DefsModlist: 'app.bsky.graph.defs#modlist',
  DefsCuratelist: 'app.bsky.graph.defs#curatelist',
  DefsReferencelist: 'app.bsky.graph.defs#referencelist',
}
export const COM_ATPROTO_MODERATION = {
  DefsReasonSpam: 'com.atproto.moderation.defs#reasonSpam',
  DefsReasonViolation: 'com.atproto.moderation.defs#reasonViolation',
  DefsReasonMisleading: 'com.atproto.moderation.defs#reasonMisleading',
  DefsReasonSexual: 'com.atproto.moderation.defs#reasonSexual',
  DefsReasonRude: 'com.atproto.moderation.defs#reasonRude',
  DefsReasonOther: 'com.atproto.moderation.defs#reasonOther',
  DefsReasonAppeal: 'com.atproto.moderation.defs#reasonAppeal',
}

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  app: AppNS
  chat: ChatNS
  com: ComNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.app = new AppNS(this)
    this.chat = new ChatNS(this)
    this.com = new ComNS(this)
  }
}

export class AppNS {
  _server: Server
  bsky: AppBskyNS

  constructor(server: Server) {
    this._server = server
    this.bsky = new AppBskyNS(server)
  }
}

export class AppBskyNS {
  _server: Server
  actor: AppBskyActorNS
  ageassurance: AppBskyAgeassuranceNS
  bookmark: AppBskyBookmarkNS
  contact: AppBskyContactNS
  draft: AppBskyDraftNS
  embed: AppBskyEmbedNS
  feed: AppBskyFeedNS
  graph: AppBskyGraphNS
  labeler: AppBskyLabelerNS
  notification: AppBskyNotificationNS
  richtext: AppBskyRichtextNS
  unspecced: AppBskyUnspeccedNS
  video: AppBskyVideoNS

  constructor(server: Server) {
    this._server = server
    this.actor = new AppBskyActorNS(server)
    this.ageassurance = new AppBskyAgeassuranceNS(server)
    this.bookmark = new AppBskyBookmarkNS(server)
    this.contact = new AppBskyContactNS(server)
    this.draft = new AppBskyDraftNS(server)
    this.embed = new AppBskyEmbedNS(server)
    this.feed = new AppBskyFeedNS(server)
    this.graph = new AppBskyGraphNS(server)
    this.labeler = new AppBskyLabelerNS(server)
    this.notification = new AppBskyNotificationNS(server)
    this.richtext = new AppBskyRichtextNS(server)
    this.unspecced = new AppBskyUnspeccedNS(server)
    this.video = new AppBskyVideoNS(server)
  }
}

export class AppBskyActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetPreferences.QueryParams,
      AppBskyActorGetPreferences.HandlerInput,
      AppBskyActorGetPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfile<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetProfile.QueryParams,
      AppBskyActorGetProfile.HandlerInput,
      AppBskyActorGetProfile.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfiles<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetProfiles.QueryParams,
      AppBskyActorGetProfiles.HandlerInput,
      AppBskyActorGetProfiles.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getProfiles' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetSuggestions.QueryParams,
      AppBskyActorGetSuggestions.HandlerInput,
      AppBskyActorGetSuggestions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getSuggestions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorPutPreferences.QueryParams,
      AppBskyActorPutPreferences.HandlerInput,
      AppBskyActorPutPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.putPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActors<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorSearchActors.QueryParams,
      AppBskyActorSearchActors.HandlerInput,
      AppBskyActorSearchActors.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.searchActors' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActorsTypeahead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorSearchActorsTypeahead.QueryParams,
      AppBskyActorSearchActorsTypeahead.HandlerInput,
      AppBskyActorSearchActorsTypeahead.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.searchActorsTypeahead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyAgeassuranceNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  begin<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyAgeassuranceBegin.QueryParams,
      AppBskyAgeassuranceBegin.HandlerInput,
      AppBskyAgeassuranceBegin.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.ageassurance.begin' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConfig<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyAgeassuranceGetConfig.QueryParams,
      AppBskyAgeassuranceGetConfig.HandlerInput,
      AppBskyAgeassuranceGetConfig.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.ageassurance.getConfig' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getState<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyAgeassuranceGetState.QueryParams,
      AppBskyAgeassuranceGetState.HandlerInput,
      AppBskyAgeassuranceGetState.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.ageassurance.getState' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyBookmarkNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createBookmark<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyBookmarkCreateBookmark.QueryParams,
      AppBskyBookmarkCreateBookmark.HandlerInput,
      AppBskyBookmarkCreateBookmark.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.bookmark.createBookmark' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteBookmark<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyBookmarkDeleteBookmark.QueryParams,
      AppBskyBookmarkDeleteBookmark.HandlerInput,
      AppBskyBookmarkDeleteBookmark.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.bookmark.deleteBookmark' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getBookmarks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyBookmarkGetBookmarks.QueryParams,
      AppBskyBookmarkGetBookmarks.HandlerInput,
      AppBskyBookmarkGetBookmarks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.bookmark.getBookmarks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyContactNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  dismissMatch<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactDismissMatch.QueryParams,
      AppBskyContactDismissMatch.HandlerInput,
      AppBskyContactDismissMatch.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.dismissMatch' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMatches<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactGetMatches.QueryParams,
      AppBskyContactGetMatches.HandlerInput,
      AppBskyContactGetMatches.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.getMatches' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSyncStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactGetSyncStatus.QueryParams,
      AppBskyContactGetSyncStatus.HandlerInput,
      AppBskyContactGetSyncStatus.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.getSyncStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  importContacts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactImportContacts.QueryParams,
      AppBskyContactImportContacts.HandlerInput,
      AppBskyContactImportContacts.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.importContacts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  removeData<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactRemoveData.QueryParams,
      AppBskyContactRemoveData.HandlerInput,
      AppBskyContactRemoveData.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.removeData' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendNotification<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactSendNotification.QueryParams,
      AppBskyContactSendNotification.HandlerInput,
      AppBskyContactSendNotification.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.sendNotification' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  startPhoneVerification<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactStartPhoneVerification.QueryParams,
      AppBskyContactStartPhoneVerification.HandlerInput,
      AppBskyContactStartPhoneVerification.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.startPhoneVerification' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  verifyPhone<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyContactVerifyPhone.QueryParams,
      AppBskyContactVerifyPhone.HandlerInput,
      AppBskyContactVerifyPhone.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.contact.verifyPhone' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyDraftNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createDraft<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyDraftCreateDraft.QueryParams,
      AppBskyDraftCreateDraft.HandlerInput,
      AppBskyDraftCreateDraft.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.draft.createDraft' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteDraft<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyDraftDeleteDraft.QueryParams,
      AppBskyDraftDeleteDraft.HandlerInput,
      AppBskyDraftDeleteDraft.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.draft.deleteDraft' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getDrafts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyDraftGetDrafts.QueryParams,
      AppBskyDraftGetDrafts.HandlerInput,
      AppBskyDraftGetDrafts.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.draft.getDrafts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateDraft<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyDraftUpdateDraft.QueryParams,
      AppBskyDraftUpdateDraft.HandlerInput,
      AppBskyDraftUpdateDraft.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.draft.updateDraft' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyEmbedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppBskyFeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  describeFeedGenerator<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedDescribeFeedGenerator.QueryParams,
      AppBskyFeedDescribeFeedGenerator.HandlerInput,
      AppBskyFeedDescribeFeedGenerator.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.describeFeedGenerator' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getActorFeeds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetActorFeeds.QueryParams,
      AppBskyFeedGetActorFeeds.HandlerInput,
      AppBskyFeedGetActorFeeds.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getActorFeeds' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getActorLikes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetActorLikes.QueryParams,
      AppBskyFeedGetActorLikes.HandlerInput,
      AppBskyFeedGetActorLikes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getActorLikes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getAuthorFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetAuthorFeed.QueryParams,
      AppBskyFeedGetAuthorFeed.HandlerInput,
      AppBskyFeedGetAuthorFeed.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getAuthorFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeed.QueryParams,
      AppBskyFeedGetFeed.HandlerInput,
      AppBskyFeedGetFeed.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeedGenerator<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeedGenerator.QueryParams,
      AppBskyFeedGetFeedGenerator.HandlerInput,
      AppBskyFeedGetFeedGenerator.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeedGenerator' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeedGenerators<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeedGenerators.QueryParams,
      AppBskyFeedGetFeedGenerators.HandlerInput,
      AppBskyFeedGetFeedGenerators.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeedGenerators' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeedSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeedSkeleton.QueryParams,
      AppBskyFeedGetFeedSkeleton.HandlerInput,
      AppBskyFeedGetFeedSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeedSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLikes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetLikes.QueryParams,
      AppBskyFeedGetLikes.HandlerInput,
      AppBskyFeedGetLikes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getLikes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetListFeed.QueryParams,
      AppBskyFeedGetListFeed.HandlerInput,
      AppBskyFeedGetListFeed.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getListFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPostThread<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetPostThread.QueryParams,
      AppBskyFeedGetPostThread.HandlerInput,
      AppBskyFeedGetPostThread.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getPostThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPosts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetPosts.QueryParams,
      AppBskyFeedGetPosts.HandlerInput,
      AppBskyFeedGetPosts.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getPosts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getQuotes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetQuotes.QueryParams,
      AppBskyFeedGetQuotes.HandlerInput,
      AppBskyFeedGetQuotes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getQuotes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepostedBy<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetRepostedBy.QueryParams,
      AppBskyFeedGetRepostedBy.HandlerInput,
      AppBskyFeedGetRepostedBy.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getRepostedBy' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFeeds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetSuggestedFeeds.QueryParams,
      AppBskyFeedGetSuggestedFeeds.HandlerInput,
      AppBskyFeedGetSuggestedFeeds.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getSuggestedFeeds' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTimeline<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetTimeline.QueryParams,
      AppBskyFeedGetTimeline.HandlerInput,
      AppBskyFeedGetTimeline.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getTimeline' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchPosts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedSearchPosts.QueryParams,
      AppBskyFeedSearchPosts.HandlerInput,
      AppBskyFeedSearchPosts.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.searchPosts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendInteractions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedSendInteractions.QueryParams,
      AppBskyFeedSendInteractions.HandlerInput,
      AppBskyFeedSendInteractions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.sendInteractions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getActorStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetActorStarterPacks.QueryParams,
      AppBskyGraphGetActorStarterPacks.HandlerInput,
      AppBskyGraphGetActorStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getActorStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getBlocks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetBlocks.QueryParams,
      AppBskyGraphGetBlocks.HandlerInput,
      AppBskyGraphGetBlocks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getBlocks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollowers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetFollowers.QueryParams,
      AppBskyGraphGetFollowers.HandlerInput,
      AppBskyGraphGetFollowers.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollows<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetFollows.QueryParams,
      AppBskyGraphGetFollows.HandlerInput,
      AppBskyGraphGetFollows.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getKnownFollowers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetKnownFollowers.QueryParams,
      AppBskyGraphGetKnownFollowers.HandlerInput,
      AppBskyGraphGetKnownFollowers.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getKnownFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getList<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetList.QueryParams,
      AppBskyGraphGetList.HandlerInput,
      AppBskyGraphGetList.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getList' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListBlocks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetListBlocks.QueryParams,
      AppBskyGraphGetListBlocks.HandlerInput,
      AppBskyGraphGetListBlocks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getListBlocks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListMutes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetListMutes.QueryParams,
      AppBskyGraphGetListMutes.HandlerInput,
      AppBskyGraphGetListMutes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getListMutes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLists<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetLists.QueryParams,
      AppBskyGraphGetLists.HandlerInput,
      AppBskyGraphGetLists.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getLists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListsWithMembership<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetListsWithMembership.QueryParams,
      AppBskyGraphGetListsWithMembership.HandlerInput,
      AppBskyGraphGetListsWithMembership.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getListsWithMembership' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMutes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetMutes.QueryParams,
      AppBskyGraphGetMutes.HandlerInput,
      AppBskyGraphGetMutes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getMutes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRelationships<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetRelationships.QueryParams,
      AppBskyGraphGetRelationships.HandlerInput,
      AppBskyGraphGetRelationships.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getRelationships' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getStarterPack<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetStarterPack.QueryParams,
      AppBskyGraphGetStarterPack.HandlerInput,
      AppBskyGraphGetStarterPack.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getStarterPack' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetStarterPacks.QueryParams,
      AppBskyGraphGetStarterPacks.HandlerInput,
      AppBskyGraphGetStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getStarterPacksWithMembership<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetStarterPacksWithMembership.QueryParams,
      AppBskyGraphGetStarterPacksWithMembership.HandlerInput,
      AppBskyGraphGetStarterPacksWithMembership.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getStarterPacksWithMembership' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFollowsByActor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetSuggestedFollowsByActor.QueryParams,
      AppBskyGraphGetSuggestedFollowsByActor.HandlerInput,
      AppBskyGraphGetSuggestedFollowsByActor.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getSuggestedFollowsByActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteActor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphMuteActor.QueryParams,
      AppBskyGraphMuteActor.HandlerInput,
      AppBskyGraphMuteActor.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.muteActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteActorList<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphMuteActorList.QueryParams,
      AppBskyGraphMuteActorList.HandlerInput,
      AppBskyGraphMuteActorList.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.muteActorList' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteThread<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphMuteThread.QueryParams,
      AppBskyGraphMuteThread.HandlerInput,
      AppBskyGraphMuteThread.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.muteThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphSearchStarterPacks.QueryParams,
      AppBskyGraphSearchStarterPacks.HandlerInput,
      AppBskyGraphSearchStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.searchStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteActor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphUnmuteActor.QueryParams,
      AppBskyGraphUnmuteActor.HandlerInput,
      AppBskyGraphUnmuteActor.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.unmuteActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteActorList<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphUnmuteActorList.QueryParams,
      AppBskyGraphUnmuteActorList.HandlerInput,
      AppBskyGraphUnmuteActorList.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.unmuteActorList' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteThread<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphUnmuteThread.QueryParams,
      AppBskyGraphUnmuteThread.HandlerInput,
      AppBskyGraphUnmuteThread.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.unmuteThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyLabelerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getServices<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyLabelerGetServices.QueryParams,
      AppBskyLabelerGetServices.HandlerInput,
      AppBskyLabelerGetServices.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.labeler.getServices' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyNotificationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationGetPreferences.QueryParams,
      AppBskyNotificationGetPreferences.HandlerInput,
      AppBskyNotificationGetPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.getPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUnreadCount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationGetUnreadCount.QueryParams,
      AppBskyNotificationGetUnreadCount.HandlerInput,
      AppBskyNotificationGetUnreadCount.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.getUnreadCount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listActivitySubscriptions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationListActivitySubscriptions.QueryParams,
      AppBskyNotificationListActivitySubscriptions.HandlerInput,
      AppBskyNotificationListActivitySubscriptions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.listActivitySubscriptions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listNotifications<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationListNotifications.QueryParams,
      AppBskyNotificationListNotifications.HandlerInput,
      AppBskyNotificationListNotifications.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.listNotifications' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putActivitySubscription<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationPutActivitySubscription.QueryParams,
      AppBskyNotificationPutActivitySubscription.HandlerInput,
      AppBskyNotificationPutActivitySubscription.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.putActivitySubscription' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationPutPreferences.QueryParams,
      AppBskyNotificationPutPreferences.HandlerInput,
      AppBskyNotificationPutPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.putPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putPreferencesV2<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationPutPreferencesV2.QueryParams,
      AppBskyNotificationPutPreferencesV2.HandlerInput,
      AppBskyNotificationPutPreferencesV2.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.putPreferencesV2' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  registerPush<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationRegisterPush.QueryParams,
      AppBskyNotificationRegisterPush.HandlerInput,
      AppBskyNotificationRegisterPush.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.registerPush' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unregisterPush<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationUnregisterPush.QueryParams,
      AppBskyNotificationUnregisterPush.HandlerInput,
      AppBskyNotificationUnregisterPush.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.unregisterPush' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateSeen<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationUpdateSeen.QueryParams,
      AppBskyNotificationUpdateSeen.HandlerInput,
      AppBskyNotificationUpdateSeen.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.updateSeen' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyRichtextNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppBskyUnspeccedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAgeAssuranceState<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetAgeAssuranceState.QueryParams,
      AppBskyUnspeccedGetAgeAssuranceState.HandlerInput,
      AppBskyUnspeccedGetAgeAssuranceState.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getAgeAssuranceState' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConfig<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetConfig.QueryParams,
      AppBskyUnspeccedGetConfig.HandlerInput,
      AppBskyUnspeccedGetConfig.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getConfig' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getOnboardingSuggestedStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetOnboardingSuggestedStarterPacks.QueryParams,
      AppBskyUnspeccedGetOnboardingSuggestedStarterPacks.HandlerInput,
      AppBskyUnspeccedGetOnboardingSuggestedStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getOnboardingSuggestedStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getOnboardingSuggestedStarterPacksSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton.QueryParams,
      AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton.HandlerInput,
      AppBskyUnspeccedGetOnboardingSuggestedStarterPacksSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getOnboardingSuggestedStarterPacksSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPopularFeedGenerators<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetPopularFeedGenerators.QueryParams,
      AppBskyUnspeccedGetPopularFeedGenerators.HandlerInput,
      AppBskyUnspeccedGetPopularFeedGenerators.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getPopularFeedGenerators' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPostThreadOtherV2<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetPostThreadOtherV2.QueryParams,
      AppBskyUnspeccedGetPostThreadOtherV2.HandlerInput,
      AppBskyUnspeccedGetPostThreadOtherV2.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getPostThreadOtherV2' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPostThreadV2<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetPostThreadV2.QueryParams,
      AppBskyUnspeccedGetPostThreadV2.HandlerInput,
      AppBskyUnspeccedGetPostThreadV2.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getPostThreadV2' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFeeds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedFeeds.QueryParams,
      AppBskyUnspeccedGetSuggestedFeeds.HandlerInput,
      AppBskyUnspeccedGetSuggestedFeeds.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedFeeds' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFeedsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedFeedsSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestedFeedsSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestedFeedsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedFeedsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedStarterPacks.QueryParams,
      AppBskyUnspeccedGetSuggestedStarterPacks.HandlerInput,
      AppBskyUnspeccedGetSuggestedStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedStarterPacksSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedStarterPacksSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedUsers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedUsers.QueryParams,
      AppBskyUnspeccedGetSuggestedUsers.HandlerInput,
      AppBskyUnspeccedGetSuggestedUsers.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedUsers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedUsersSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedUsersSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestedUsersSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestedUsersSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedUsersSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestionsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestionsSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestionsSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestionsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestionsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTaggedSuggestions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTaggedSuggestions.QueryParams,
      AppBskyUnspeccedGetTaggedSuggestions.HandlerInput,
      AppBskyUnspeccedGetTaggedSuggestions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTaggedSuggestions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTrendingTopics<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTrendingTopics.QueryParams,
      AppBskyUnspeccedGetTrendingTopics.HandlerInput,
      AppBskyUnspeccedGetTrendingTopics.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTrendingTopics' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTrends<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTrends.QueryParams,
      AppBskyUnspeccedGetTrends.HandlerInput,
      AppBskyUnspeccedGetTrends.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTrends' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTrendsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTrendsSkeleton.QueryParams,
      AppBskyUnspeccedGetTrendsSkeleton.HandlerInput,
      AppBskyUnspeccedGetTrendsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTrendsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  initAgeAssurance<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedInitAgeAssurance.QueryParams,
      AppBskyUnspeccedInitAgeAssurance.HandlerInput,
      AppBskyUnspeccedInitAgeAssurance.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.initAgeAssurance' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActorsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedSearchActorsSkeleton.QueryParams,
      AppBskyUnspeccedSearchActorsSkeleton.HandlerInput,
      AppBskyUnspeccedSearchActorsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.searchActorsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchPostsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedSearchPostsSkeleton.QueryParams,
      AppBskyUnspeccedSearchPostsSkeleton.HandlerInput,
      AppBskyUnspeccedSearchPostsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.searchPostsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchStarterPacksSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedSearchStarterPacksSkeleton.QueryParams,
      AppBskyUnspeccedSearchStarterPacksSkeleton.HandlerInput,
      AppBskyUnspeccedSearchStarterPacksSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.searchStarterPacksSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppBskyVideoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getJobStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyVideoGetJobStatus.QueryParams,
      AppBskyVideoGetJobStatus.HandlerInput,
      AppBskyVideoGetJobStatus.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.video.getJobStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUploadLimits<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyVideoGetUploadLimits.QueryParams,
      AppBskyVideoGetUploadLimits.HandlerInput,
      AppBskyVideoGetUploadLimits.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.video.getUploadLimits' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  uploadVideo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyVideoUploadVideo.QueryParams,
      AppBskyVideoUploadVideo.HandlerInput,
      AppBskyVideoUploadVideo.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.video.uploadVideo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ChatNS {
  _server: Server
  bsky: ChatBskyNS

  constructor(server: Server) {
    this._server = server
    this.bsky = new ChatBskyNS(server)
  }
}

export class ChatBskyNS {
  _server: Server
  actor: ChatBskyActorNS
  convo: ChatBskyConvoNS
  moderation: ChatBskyModerationNS

  constructor(server: Server) {
    this._server = server
    this.actor = new ChatBskyActorNS(server)
    this.convo = new ChatBskyConvoNS(server)
    this.moderation = new ChatBskyModerationNS(server)
  }
}

export class ChatBskyActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deleteAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyActorDeleteAccount.QueryParams,
      ChatBskyActorDeleteAccount.HandlerInput,
      ChatBskyActorDeleteAccount.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.actor.deleteAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  exportAccountData<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyActorExportAccountData.QueryParams,
      ChatBskyActorExportAccountData.HandlerInput,
      ChatBskyActorExportAccountData.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.actor.exportAccountData' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ChatBskyConvoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  acceptConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoAcceptConvo.QueryParams,
      ChatBskyConvoAcceptConvo.HandlerInput,
      ChatBskyConvoAcceptConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.acceptConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  addReaction<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoAddReaction.QueryParams,
      ChatBskyConvoAddReaction.HandlerInput,
      ChatBskyConvoAddReaction.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.addReaction' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteMessageForSelf<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoDeleteMessageForSelf.QueryParams,
      ChatBskyConvoDeleteMessageForSelf.HandlerInput,
      ChatBskyConvoDeleteMessageForSelf.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.deleteMessageForSelf' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetConvo.QueryParams,
      ChatBskyConvoGetConvo.HandlerInput,
      ChatBskyConvoGetConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConvoAvailability<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetConvoAvailability.QueryParams,
      ChatBskyConvoGetConvoAvailability.HandlerInput,
      ChatBskyConvoGetConvoAvailability.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getConvoAvailability' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConvoForMembers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetConvoForMembers.QueryParams,
      ChatBskyConvoGetConvoForMembers.HandlerInput,
      ChatBskyConvoGetConvoForMembers.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getConvoForMembers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLog<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetLog.QueryParams,
      ChatBskyConvoGetLog.HandlerInput,
      ChatBskyConvoGetLog.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getLog' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMessages<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetMessages.QueryParams,
      ChatBskyConvoGetMessages.HandlerInput,
      ChatBskyConvoGetMessages.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getMessages' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  leaveConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoLeaveConvo.QueryParams,
      ChatBskyConvoLeaveConvo.HandlerInput,
      ChatBskyConvoLeaveConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.leaveConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listConvos<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoListConvos.QueryParams,
      ChatBskyConvoListConvos.HandlerInput,
      ChatBskyConvoListConvos.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.listConvos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoMuteConvo.QueryParams,
      ChatBskyConvoMuteConvo.HandlerInput,
      ChatBskyConvoMuteConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.muteConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  removeReaction<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoRemoveReaction.QueryParams,
      ChatBskyConvoRemoveReaction.HandlerInput,
      ChatBskyConvoRemoveReaction.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.removeReaction' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendMessage<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoSendMessage.QueryParams,
      ChatBskyConvoSendMessage.HandlerInput,
      ChatBskyConvoSendMessage.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.sendMessage' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendMessageBatch<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoSendMessageBatch.QueryParams,
      ChatBskyConvoSendMessageBatch.HandlerInput,
      ChatBskyConvoSendMessageBatch.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.sendMessageBatch' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoUnmuteConvo.QueryParams,
      ChatBskyConvoUnmuteConvo.HandlerInput,
      ChatBskyConvoUnmuteConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.unmuteConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateAllRead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoUpdateAllRead.QueryParams,
      ChatBskyConvoUpdateAllRead.HandlerInput,
      ChatBskyConvoUpdateAllRead.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.updateAllRead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateRead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoUpdateRead.QueryParams,
      ChatBskyConvoUpdateRead.HandlerInput,
      ChatBskyConvoUpdateRead.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.updateRead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ChatBskyModerationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getActorMetadata<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyModerationGetActorMetadata.QueryParams,
      ChatBskyModerationGetActorMetadata.HandlerInput,
      ChatBskyModerationGetActorMetadata.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.moderation.getActorMetadata' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMessageContext<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyModerationGetMessageContext.QueryParams,
      ChatBskyModerationGetMessageContext.HandlerInput,
      ChatBskyModerationGetMessageContext.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.moderation.getMessageContext' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateActorAccess<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyModerationUpdateActorAccess.QueryParams,
      ChatBskyModerationUpdateActorAccess.HandlerInput,
      ChatBskyModerationUpdateActorAccess.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.moderation.updateActorAccess' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComNS {
  _server: Server
  atproto: ComAtprotoNS
  germnetwork: ComGermnetworkNS

  constructor(server: Server) {
    this._server = server
    this.atproto = new ComAtprotoNS(server)
    this.germnetwork = new ComGermnetworkNS(server)
  }
}

export class ComAtprotoNS {
  _server: Server
  admin: ComAtprotoAdminNS
  identity: ComAtprotoIdentityNS
  label: ComAtprotoLabelNS
  lexicon: ComAtprotoLexiconNS
  moderation: ComAtprotoModerationNS
  repo: ComAtprotoRepoNS
  server: ComAtprotoServerNS
  sync: ComAtprotoSyncNS
  temp: ComAtprotoTempNS

  constructor(server: Server) {
    this._server = server
    this.admin = new ComAtprotoAdminNS(server)
    this.identity = new ComAtprotoIdentityNS(server)
    this.label = new ComAtprotoLabelNS(server)
    this.lexicon = new ComAtprotoLexiconNS(server)
    this.moderation = new ComAtprotoModerationNS(server)
    this.repo = new ComAtprotoRepoNS(server)
    this.server = new ComAtprotoServerNS(server)
    this.sync = new ComAtprotoSyncNS(server)
    this.temp = new ComAtprotoTempNS(server)
  }
}

export class ComAtprotoAdminNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deleteAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminDeleteAccount.QueryParams,
      ComAtprotoAdminDeleteAccount.HandlerInput,
      ComAtprotoAdminDeleteAccount.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.deleteAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  disableAccountInvites<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminDisableAccountInvites.QueryParams,
      ComAtprotoAdminDisableAccountInvites.HandlerInput,
      ComAtprotoAdminDisableAccountInvites.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.disableAccountInvites' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  disableInviteCodes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminDisableInviteCodes.QueryParams,
      ComAtprotoAdminDisableInviteCodes.HandlerInput,
      ComAtprotoAdminDisableInviteCodes.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.disableInviteCodes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  enableAccountInvites<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminEnableAccountInvites.QueryParams,
      ComAtprotoAdminEnableAccountInvites.HandlerInput,
      ComAtprotoAdminEnableAccountInvites.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.enableAccountInvites' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getAccountInfo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminGetAccountInfo.QueryParams,
      ComAtprotoAdminGetAccountInfo.HandlerInput,
      ComAtprotoAdminGetAccountInfo.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.getAccountInfo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getAccountInfos<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminGetAccountInfos.QueryParams,
      ComAtprotoAdminGetAccountInfos.HandlerInput,
      ComAtprotoAdminGetAccountInfos.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.getAccountInfos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getInviteCodes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminGetInviteCodes.QueryParams,
      ComAtprotoAdminGetInviteCodes.HandlerInput,
      ComAtprotoAdminGetInviteCodes.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.getInviteCodes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getNeuroLink<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminGetNeuroLink.QueryParams,
      ComAtprotoAdminGetNeuroLink.HandlerInput,
      ComAtprotoAdminGetNeuroLink.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.getNeuroLink' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSubjectStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminGetSubjectStatus.QueryParams,
      ComAtprotoAdminGetSubjectStatus.HandlerInput,
      ComAtprotoAdminGetSubjectStatus.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.getSubjectStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  importAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminImportAccount.QueryParams,
      ComAtprotoAdminImportAccount.HandlerInput,
      ComAtprotoAdminImportAccount.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.importAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listNeuroAccounts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminListNeuroAccounts.QueryParams,
      ComAtprotoAdminListNeuroAccounts.HandlerInput,
      ComAtprotoAdminListNeuroAccounts.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.listNeuroAccounts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  migrateAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminMigrateAccount.QueryParams,
      ComAtprotoAdminMigrateAccount.HandlerInput,
      ComAtprotoAdminMigrateAccount.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.migrateAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchAccounts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminSearchAccounts.QueryParams,
      ComAtprotoAdminSearchAccounts.HandlerInput,
      ComAtprotoAdminSearchAccounts.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.searchAccounts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendEmail<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminSendEmail.QueryParams,
      ComAtprotoAdminSendEmail.HandlerInput,
      ComAtprotoAdminSendEmail.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.sendEmail' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateAccountEmail<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminUpdateAccountEmail.QueryParams,
      ComAtprotoAdminUpdateAccountEmail.HandlerInput,
      ComAtprotoAdminUpdateAccountEmail.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.updateAccountEmail' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateAccountHandle<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminUpdateAccountHandle.QueryParams,
      ComAtprotoAdminUpdateAccountHandle.HandlerInput,
      ComAtprotoAdminUpdateAccountHandle.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.updateAccountHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateAccountPassword<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminUpdateAccountPassword.QueryParams,
      ComAtprotoAdminUpdateAccountPassword.HandlerInput,
      ComAtprotoAdminUpdateAccountPassword.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.updateAccountPassword' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateAccountSigningKey<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminUpdateAccountSigningKey.QueryParams,
      ComAtprotoAdminUpdateAccountSigningKey.HandlerInput,
      ComAtprotoAdminUpdateAccountSigningKey.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.updateAccountSigningKey' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateNeuroLink<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminUpdateNeuroLink.QueryParams,
      ComAtprotoAdminUpdateNeuroLink.HandlerInput,
      ComAtprotoAdminUpdateNeuroLink.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.updateNeuroLink' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateSubjectStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminUpdateSubjectStatus.QueryParams,
      ComAtprotoAdminUpdateSubjectStatus.HandlerInput,
      ComAtprotoAdminUpdateSubjectStatus.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.updateSubjectStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  validateMigrationTarget<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoAdminValidateMigrationTarget.QueryParams,
      ComAtprotoAdminValidateMigrationTarget.HandlerInput,
      ComAtprotoAdminValidateMigrationTarget.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.admin.validateMigrationTarget' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComAtprotoIdentityNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getRecommendedDidCredentials<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityGetRecommendedDidCredentials.QueryParams,
      ComAtprotoIdentityGetRecommendedDidCredentials.HandlerInput,
      ComAtprotoIdentityGetRecommendedDidCredentials.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.getRecommendedDidCredentials' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  refreshIdentity<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityRefreshIdentity.QueryParams,
      ComAtprotoIdentityRefreshIdentity.HandlerInput,
      ComAtprotoIdentityRefreshIdentity.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.refreshIdentity' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestPlcOperationSignature<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityRequestPlcOperationSignature.QueryParams,
      ComAtprotoIdentityRequestPlcOperationSignature.HandlerInput,
      ComAtprotoIdentityRequestPlcOperationSignature.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.requestPlcOperationSignature' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resolveDid<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityResolveDid.QueryParams,
      ComAtprotoIdentityResolveDid.HandlerInput,
      ComAtprotoIdentityResolveDid.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.resolveDid' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resolveHandle<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityResolveHandle.QueryParams,
      ComAtprotoIdentityResolveHandle.HandlerInput,
      ComAtprotoIdentityResolveHandle.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.resolveHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resolveIdentity<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityResolveIdentity.QueryParams,
      ComAtprotoIdentityResolveIdentity.HandlerInput,
      ComAtprotoIdentityResolveIdentity.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.resolveIdentity' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  signPlcOperation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentitySignPlcOperation.QueryParams,
      ComAtprotoIdentitySignPlcOperation.HandlerInput,
      ComAtprotoIdentitySignPlcOperation.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.signPlcOperation' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  submitPlcOperation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentitySubmitPlcOperation.QueryParams,
      ComAtprotoIdentitySubmitPlcOperation.HandlerInput,
      ComAtprotoIdentitySubmitPlcOperation.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.submitPlcOperation' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateHandle<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityUpdateHandle.QueryParams,
      ComAtprotoIdentityUpdateHandle.HandlerInput,
      ComAtprotoIdentityUpdateHandle.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.updateHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComAtprotoLabelNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  queryLabels<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoLabelQueryLabels.QueryParams,
      ComAtprotoLabelQueryLabels.HandlerInput,
      ComAtprotoLabelQueryLabels.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.label.queryLabels' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  subscribeLabels<A extends Auth = void>(
    cfg: StreamConfigOrHandler<
      A,
      ComAtprotoLabelSubscribeLabels.QueryParams,
      ComAtprotoLabelSubscribeLabels.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.label.subscribeLabels' // @ts-ignore
    return this._server.xrpc.streamMethod(nsid, cfg)
  }
}

export class ComAtprotoLexiconNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  resolveLexicon<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoLexiconResolveLexicon.QueryParams,
      ComAtprotoLexiconResolveLexicon.HandlerInput,
      ComAtprotoLexiconResolveLexicon.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.lexicon.resolveLexicon' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComAtprotoModerationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createReport<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoModerationCreateReport.QueryParams,
      ComAtprotoModerationCreateReport.HandlerInput,
      ComAtprotoModerationCreateReport.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.moderation.createReport' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComAtprotoRepoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  applyWrites<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoApplyWrites.QueryParams,
      ComAtprotoRepoApplyWrites.HandlerInput,
      ComAtprotoRepoApplyWrites.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.applyWrites' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoCreateRecord.QueryParams,
      ComAtprotoRepoCreateRecord.HandlerInput,
      ComAtprotoRepoCreateRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.createRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoDeleteRecord.QueryParams,
      ComAtprotoRepoDeleteRecord.HandlerInput,
      ComAtprotoRepoDeleteRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.deleteRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  describeRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoDescribeRepo.QueryParams,
      ComAtprotoRepoDescribeRepo.HandlerInput,
      ComAtprotoRepoDescribeRepo.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.describeRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoGetRecord.QueryParams,
      ComAtprotoRepoGetRecord.HandlerInput,
      ComAtprotoRepoGetRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  importRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoImportRepo.QueryParams,
      ComAtprotoRepoImportRepo.HandlerInput,
      ComAtprotoRepoImportRepo.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.importRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listMissingBlobs<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoListMissingBlobs.QueryParams,
      ComAtprotoRepoListMissingBlobs.HandlerInput,
      ComAtprotoRepoListMissingBlobs.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.listMissingBlobs' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listRecords<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoListRecords.QueryParams,
      ComAtprotoRepoListRecords.HandlerInput,
      ComAtprotoRepoListRecords.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.listRecords' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoPutRecord.QueryParams,
      ComAtprotoRepoPutRecord.HandlerInput,
      ComAtprotoRepoPutRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.putRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  uploadBlob<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoUploadBlob.QueryParams,
      ComAtprotoRepoUploadBlob.HandlerInput,
      ComAtprotoRepoUploadBlob.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.uploadBlob' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComAtprotoServerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  activateAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerActivateAccount.QueryParams,
      ComAtprotoServerActivateAccount.HandlerInput,
      ComAtprotoServerActivateAccount.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.activateAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  checkAccountStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerCheckAccountStatus.QueryParams,
      ComAtprotoServerCheckAccountStatus.HandlerInput,
      ComAtprotoServerCheckAccountStatus.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.checkAccountStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  confirmEmail<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerConfirmEmail.QueryParams,
      ComAtprotoServerConfirmEmail.HandlerInput,
      ComAtprotoServerConfirmEmail.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.confirmEmail' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerCreateAccount.QueryParams,
      ComAtprotoServerCreateAccount.HandlerInput,
      ComAtprotoServerCreateAccount.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.createAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createAppPassword<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerCreateAppPassword.QueryParams,
      ComAtprotoServerCreateAppPassword.HandlerInput,
      ComAtprotoServerCreateAppPassword.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.createAppPassword' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createInviteCode<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerCreateInviteCode.QueryParams,
      ComAtprotoServerCreateInviteCode.HandlerInput,
      ComAtprotoServerCreateInviteCode.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.createInviteCode' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createInviteCodes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerCreateInviteCodes.QueryParams,
      ComAtprotoServerCreateInviteCodes.HandlerInput,
      ComAtprotoServerCreateInviteCodes.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.createInviteCodes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createSession<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerCreateSession.QueryParams,
      ComAtprotoServerCreateSession.HandlerInput,
      ComAtprotoServerCreateSession.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.createSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deactivateAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerDeactivateAccount.QueryParams,
      ComAtprotoServerDeactivateAccount.HandlerInput,
      ComAtprotoServerDeactivateAccount.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.deactivateAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerDeleteAccount.QueryParams,
      ComAtprotoServerDeleteAccount.HandlerInput,
      ComAtprotoServerDeleteAccount.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.deleteAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteSession<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerDeleteSession.QueryParams,
      ComAtprotoServerDeleteSession.HandlerInput,
      ComAtprotoServerDeleteSession.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.deleteSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  describeServer<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerDescribeServer.QueryParams,
      ComAtprotoServerDescribeServer.HandlerInput,
      ComAtprotoServerDescribeServer.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.describeServer' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getAccountInviteCodes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerGetAccountInviteCodes.QueryParams,
      ComAtprotoServerGetAccountInviteCodes.HandlerInput,
      ComAtprotoServerGetAccountInviteCodes.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.getAccountInviteCodes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getServiceAuth<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerGetServiceAuth.QueryParams,
      ComAtprotoServerGetServiceAuth.HandlerInput,
      ComAtprotoServerGetServiceAuth.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.getServiceAuth' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSession<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerGetSession.QueryParams,
      ComAtprotoServerGetSession.HandlerInput,
      ComAtprotoServerGetSession.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.getSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listAppPasswords<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerListAppPasswords.QueryParams,
      ComAtprotoServerListAppPasswords.HandlerInput,
      ComAtprotoServerListAppPasswords.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.listAppPasswords' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  refreshSession<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerRefreshSession.QueryParams,
      ComAtprotoServerRefreshSession.HandlerInput,
      ComAtprotoServerRefreshSession.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.refreshSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestAccountDelete<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerRequestAccountDelete.QueryParams,
      ComAtprotoServerRequestAccountDelete.HandlerInput,
      ComAtprotoServerRequestAccountDelete.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.requestAccountDelete' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestEmailConfirmation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerRequestEmailConfirmation.QueryParams,
      ComAtprotoServerRequestEmailConfirmation.HandlerInput,
      ComAtprotoServerRequestEmailConfirmation.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.requestEmailConfirmation' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestEmailUpdate<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerRequestEmailUpdate.QueryParams,
      ComAtprotoServerRequestEmailUpdate.HandlerInput,
      ComAtprotoServerRequestEmailUpdate.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.requestEmailUpdate' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestPasswordReset<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerRequestPasswordReset.QueryParams,
      ComAtprotoServerRequestPasswordReset.HandlerInput,
      ComAtprotoServerRequestPasswordReset.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.requestPasswordReset' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  reserveSigningKey<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerReserveSigningKey.QueryParams,
      ComAtprotoServerReserveSigningKey.HandlerInput,
      ComAtprotoServerReserveSigningKey.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.reserveSigningKey' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resetPassword<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerResetPassword.QueryParams,
      ComAtprotoServerResetPassword.HandlerInput,
      ComAtprotoServerResetPassword.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.resetPassword' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  revokeAppPassword<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerRevokeAppPassword.QueryParams,
      ComAtprotoServerRevokeAppPassword.HandlerInput,
      ComAtprotoServerRevokeAppPassword.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.revokeAppPassword' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateEmail<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoServerUpdateEmail.QueryParams,
      ComAtprotoServerUpdateEmail.HandlerInput,
      ComAtprotoServerUpdateEmail.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.server.updateEmail' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComAtprotoSyncNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getBlob<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetBlob.QueryParams,
      ComAtprotoSyncGetBlob.HandlerInput,
      ComAtprotoSyncGetBlob.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getBlob' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getBlocks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetBlocks.QueryParams,
      ComAtprotoSyncGetBlocks.HandlerInput,
      ComAtprotoSyncGetBlocks.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getBlocks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getCheckout<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetCheckout.QueryParams,
      ComAtprotoSyncGetCheckout.HandlerInput,
      ComAtprotoSyncGetCheckout.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getCheckout' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getHead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetHead.QueryParams,
      ComAtprotoSyncGetHead.HandlerInput,
      ComAtprotoSyncGetHead.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getHead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getHostStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetHostStatus.QueryParams,
      ComAtprotoSyncGetHostStatus.HandlerInput,
      ComAtprotoSyncGetHostStatus.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getHostStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLatestCommit<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetLatestCommit.QueryParams,
      ComAtprotoSyncGetLatestCommit.HandlerInput,
      ComAtprotoSyncGetLatestCommit.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getLatestCommit' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetRecord.QueryParams,
      ComAtprotoSyncGetRecord.HandlerInput,
      ComAtprotoSyncGetRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetRepo.QueryParams,
      ComAtprotoSyncGetRepo.HandlerInput,
      ComAtprotoSyncGetRepo.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepoStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetRepoStatus.QueryParams,
      ComAtprotoSyncGetRepoStatus.HandlerInput,
      ComAtprotoSyncGetRepoStatus.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getRepoStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listBlobs<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListBlobs.QueryParams,
      ComAtprotoSyncListBlobs.HandlerInput,
      ComAtprotoSyncListBlobs.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listBlobs' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listHosts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListHosts.QueryParams,
      ComAtprotoSyncListHosts.HandlerInput,
      ComAtprotoSyncListHosts.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listHosts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listRepos<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListRepos.QueryParams,
      ComAtprotoSyncListRepos.HandlerInput,
      ComAtprotoSyncListRepos.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listRepos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listReposByCollection<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListReposByCollection.QueryParams,
      ComAtprotoSyncListReposByCollection.HandlerInput,
      ComAtprotoSyncListReposByCollection.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listReposByCollection' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  notifyOfUpdate<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncNotifyOfUpdate.QueryParams,
      ComAtprotoSyncNotifyOfUpdate.HandlerInput,
      ComAtprotoSyncNotifyOfUpdate.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.notifyOfUpdate' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestCrawl<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncRequestCrawl.QueryParams,
      ComAtprotoSyncRequestCrawl.HandlerInput,
      ComAtprotoSyncRequestCrawl.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.requestCrawl' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  subscribeRepos<A extends Auth = void>(
    cfg: StreamConfigOrHandler<
      A,
      ComAtprotoSyncSubscribeRepos.QueryParams,
      ComAtprotoSyncSubscribeRepos.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.subscribeRepos' // @ts-ignore
    return this._server.xrpc.streamMethod(nsid, cfg)
  }
}

export class ComAtprotoTempNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  addReservedHandle<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempAddReservedHandle.QueryParams,
      ComAtprotoTempAddReservedHandle.HandlerInput,
      ComAtprotoTempAddReservedHandle.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.addReservedHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  checkHandleAvailability<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempCheckHandleAvailability.QueryParams,
      ComAtprotoTempCheckHandleAvailability.HandlerInput,
      ComAtprotoTempCheckHandleAvailability.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.checkHandleAvailability' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  checkSignupQueue<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempCheckSignupQueue.QueryParams,
      ComAtprotoTempCheckSignupQueue.HandlerInput,
      ComAtprotoTempCheckSignupQueue.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.checkSignupQueue' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  dereferenceScope<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempDereferenceScope.QueryParams,
      ComAtprotoTempDereferenceScope.HandlerInput,
      ComAtprotoTempDereferenceScope.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.dereferenceScope' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  fetchLabels<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempFetchLabels.QueryParams,
      ComAtprotoTempFetchLabels.HandlerInput,
      ComAtprotoTempFetchLabels.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.fetchLabels' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestPhoneVerification<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempRequestPhoneVerification.QueryParams,
      ComAtprotoTempRequestPhoneVerification.HandlerInput,
      ComAtprotoTempRequestPhoneVerification.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.requestPhoneVerification' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  revokeAccountCredentials<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempRevokeAccountCredentials.QueryParams,
      ComAtprotoTempRevokeAccountCredentials.HandlerInput,
      ComAtprotoTempRevokeAccountCredentials.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.revokeAccountCredentials' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComGermnetworkNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

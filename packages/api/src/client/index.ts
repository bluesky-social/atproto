/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  XrpcClient,
  type FetchHandler,
  type FetchHandlerOptions,
} from '@atproto/xrpc'
import { schemas } from './lexicons.js'
import { CID } from 'multiformats/cid'
import { type OmitKey, type Un$Typed } from './util.js'
import { AppNS } from './ns/app/index.js'
import { ChatNS } from './ns/chat/index.js'
import { ComNS } from './ns/com/index.js'
import { ToolsNS } from './ns/tools/index.js'

export * as AppBskyActorDefs from './types/app/bsky/actor/defs.js'
export * as AppBskyActorGetPreferences from './types/app/bsky/actor/getPreferences.js'
export * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile.js'
export * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles.js'
export * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions.js'
export * as AppBskyActorProfile from './types/app/bsky/actor/profile.js'
export * as AppBskyActorPutPreferences from './types/app/bsky/actor/putPreferences.js'
export * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors.js'
export * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead.js'
export * as AppBskyActorStatus from './types/app/bsky/actor/status.js'
export * as AppBskyEmbedDefs from './types/app/bsky/embed/defs.js'
export * as AppBskyEmbedExternal from './types/app/bsky/embed/external.js'
export * as AppBskyEmbedImages from './types/app/bsky/embed/images.js'
export * as AppBskyEmbedRecord from './types/app/bsky/embed/record.js'
export * as AppBskyEmbedRecordWithMedia from './types/app/bsky/embed/recordWithMedia.js'
export * as AppBskyEmbedVideo from './types/app/bsky/embed/video.js'
export * as AppBskyFeedDefs from './types/app/bsky/feed/defs.js'
export * as AppBskyFeedDescribeFeedGenerator from './types/app/bsky/feed/describeFeedGenerator.js'
export * as AppBskyFeedGenerator from './types/app/bsky/feed/generator.js'
export * as AppBskyFeedGetActorFeeds from './types/app/bsky/feed/getActorFeeds.js'
export * as AppBskyFeedGetActorLikes from './types/app/bsky/feed/getActorLikes.js'
export * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed.js'
export * as AppBskyFeedGetFeed from './types/app/bsky/feed/getFeed.js'
export * as AppBskyFeedGetFeedGenerator from './types/app/bsky/feed/getFeedGenerator.js'
export * as AppBskyFeedGetFeedGenerators from './types/app/bsky/feed/getFeedGenerators.js'
export * as AppBskyFeedGetFeedSkeleton from './types/app/bsky/feed/getFeedSkeleton.js'
export * as AppBskyFeedGetLikes from './types/app/bsky/feed/getLikes.js'
export * as AppBskyFeedGetListFeed from './types/app/bsky/feed/getListFeed.js'
export * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread.js'
export * as AppBskyFeedGetPosts from './types/app/bsky/feed/getPosts.js'
export * as AppBskyFeedGetQuotes from './types/app/bsky/feed/getQuotes.js'
export * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy.js'
export * as AppBskyFeedGetSuggestedFeeds from './types/app/bsky/feed/getSuggestedFeeds.js'
export * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline.js'
export * as AppBskyFeedLike from './types/app/bsky/feed/like.js'
export * as AppBskyFeedPost from './types/app/bsky/feed/post.js'
export * as AppBskyFeedPostgate from './types/app/bsky/feed/postgate.js'
export * as AppBskyFeedRepost from './types/app/bsky/feed/repost.js'
export * as AppBskyFeedSearchPosts from './types/app/bsky/feed/searchPosts.js'
export * as AppBskyFeedSendInteractions from './types/app/bsky/feed/sendInteractions.js'
export * as AppBskyFeedThreadgate from './types/app/bsky/feed/threadgate.js'
export * as AppBskyGraphBlock from './types/app/bsky/graph/block.js'
export * as AppBskyGraphDefs from './types/app/bsky/graph/defs.js'
export * as AppBskyGraphFollow from './types/app/bsky/graph/follow.js'
export * as AppBskyGraphGetActorStarterPacks from './types/app/bsky/graph/getActorStarterPacks.js'
export * as AppBskyGraphGetBlocks from './types/app/bsky/graph/getBlocks.js'
export * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers.js'
export * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows.js'
export * as AppBskyGraphGetKnownFollowers from './types/app/bsky/graph/getKnownFollowers.js'
export * as AppBskyGraphGetList from './types/app/bsky/graph/getList.js'
export * as AppBskyGraphGetListBlocks from './types/app/bsky/graph/getListBlocks.js'
export * as AppBskyGraphGetListMutes from './types/app/bsky/graph/getListMutes.js'
export * as AppBskyGraphGetLists from './types/app/bsky/graph/getLists.js'
export * as AppBskyGraphGetListsWithMembership from './types/app/bsky/graph/getListsWithMembership.js'
export * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes.js'
export * as AppBskyGraphGetRelationships from './types/app/bsky/graph/getRelationships.js'
export * as AppBskyGraphGetStarterPack from './types/app/bsky/graph/getStarterPack.js'
export * as AppBskyGraphGetStarterPacks from './types/app/bsky/graph/getStarterPacks.js'
export * as AppBskyGraphGetStarterPacksWithMembership from './types/app/bsky/graph/getStarterPacksWithMembership.js'
export * as AppBskyGraphGetSuggestedFollowsByActor from './types/app/bsky/graph/getSuggestedFollowsByActor.js'
export * as AppBskyGraphList from './types/app/bsky/graph/list.js'
export * as AppBskyGraphListblock from './types/app/bsky/graph/listblock.js'
export * as AppBskyGraphListitem from './types/app/bsky/graph/listitem.js'
export * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor.js'
export * as AppBskyGraphMuteActorList from './types/app/bsky/graph/muteActorList.js'
export * as AppBskyGraphMuteThread from './types/app/bsky/graph/muteThread.js'
export * as AppBskyGraphSearchStarterPacks from './types/app/bsky/graph/searchStarterPacks.js'
export * as AppBskyGraphStarterpack from './types/app/bsky/graph/starterpack.js'
export * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor.js'
export * as AppBskyGraphUnmuteActorList from './types/app/bsky/graph/unmuteActorList.js'
export * as AppBskyGraphUnmuteThread from './types/app/bsky/graph/unmuteThread.js'
export * as AppBskyGraphVerification from './types/app/bsky/graph/verification.js'
export * as AppBskyLabelerDefs from './types/app/bsky/labeler/defs.js'
export * as AppBskyLabelerGetServices from './types/app/bsky/labeler/getServices.js'
export * as AppBskyLabelerService from './types/app/bsky/labeler/service.js'
export * as AppBskyNotificationDeclaration from './types/app/bsky/notification/declaration.js'
export * as AppBskyNotificationDefs from './types/app/bsky/notification/defs.js'
export * as AppBskyNotificationGetPreferences from './types/app/bsky/notification/getPreferences.js'
export * as AppBskyNotificationGetUnreadCount from './types/app/bsky/notification/getUnreadCount.js'
export * as AppBskyNotificationListActivitySubscriptions from './types/app/bsky/notification/listActivitySubscriptions.js'
export * as AppBskyNotificationListNotifications from './types/app/bsky/notification/listNotifications.js'
export * as AppBskyNotificationPutActivitySubscription from './types/app/bsky/notification/putActivitySubscription.js'
export * as AppBskyNotificationPutPreferences from './types/app/bsky/notification/putPreferences.js'
export * as AppBskyNotificationPutPreferencesV2 from './types/app/bsky/notification/putPreferencesV2.js'
export * as AppBskyNotificationRegisterPush from './types/app/bsky/notification/registerPush.js'
export * as AppBskyNotificationUnregisterPush from './types/app/bsky/notification/unregisterPush.js'
export * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen.js'
export * as AppBskyRichtextFacet from './types/app/bsky/richtext/facet.js'
export * as AppBskyUnspeccedDefs from './types/app/bsky/unspecced/defs.js'
export * as AppBskyUnspeccedGetAgeAssuranceState from './types/app/bsky/unspecced/getAgeAssuranceState.js'
export * as AppBskyUnspeccedGetConfig from './types/app/bsky/unspecced/getConfig.js'
export * as AppBskyUnspeccedGetPopularFeedGenerators from './types/app/bsky/unspecced/getPopularFeedGenerators.js'
export * as AppBskyUnspeccedGetPostThreadOtherV2 from './types/app/bsky/unspecced/getPostThreadOtherV2.js'
export * as AppBskyUnspeccedGetPostThreadV2 from './types/app/bsky/unspecced/getPostThreadV2.js'
export * as AppBskyUnspeccedGetSuggestedFeeds from './types/app/bsky/unspecced/getSuggestedFeeds.js'
export * as AppBskyUnspeccedGetSuggestedFeedsSkeleton from './types/app/bsky/unspecced/getSuggestedFeedsSkeleton.js'
export * as AppBskyUnspeccedGetSuggestedStarterPacks from './types/app/bsky/unspecced/getSuggestedStarterPacks.js'
export * as AppBskyUnspeccedGetSuggestedStarterPacksSkeleton from './types/app/bsky/unspecced/getSuggestedStarterPacksSkeleton.js'
export * as AppBskyUnspeccedGetSuggestedUsers from './types/app/bsky/unspecced/getSuggestedUsers.js'
export * as AppBskyUnspeccedGetSuggestedUsersSkeleton from './types/app/bsky/unspecced/getSuggestedUsersSkeleton.js'
export * as AppBskyUnspeccedGetSuggestionsSkeleton from './types/app/bsky/unspecced/getSuggestionsSkeleton.js'
export * as AppBskyUnspeccedGetTaggedSuggestions from './types/app/bsky/unspecced/getTaggedSuggestions.js'
export * as AppBskyUnspeccedGetTrendingTopics from './types/app/bsky/unspecced/getTrendingTopics.js'
export * as AppBskyUnspeccedGetTrends from './types/app/bsky/unspecced/getTrends.js'
export * as AppBskyUnspeccedGetTrendsSkeleton from './types/app/bsky/unspecced/getTrendsSkeleton.js'
export * as AppBskyUnspeccedInitAgeAssurance from './types/app/bsky/unspecced/initAgeAssurance.js'
export * as AppBskyUnspeccedSearchActorsSkeleton from './types/app/bsky/unspecced/searchActorsSkeleton.js'
export * as AppBskyUnspeccedSearchPostsSkeleton from './types/app/bsky/unspecced/searchPostsSkeleton.js'
export * as AppBskyUnspeccedSearchStarterPacksSkeleton from './types/app/bsky/unspecced/searchStarterPacksSkeleton.js'
export * as AppBskyVideoDefs from './types/app/bsky/video/defs.js'
export * as AppBskyVideoGetJobStatus from './types/app/bsky/video/getJobStatus.js'
export * as AppBskyVideoGetUploadLimits from './types/app/bsky/video/getUploadLimits.js'
export * as AppBskyVideoUploadVideo from './types/app/bsky/video/uploadVideo.js'
export * as ChatBskyActorDeclaration from './types/chat/bsky/actor/declaration.js'
export * as ChatBskyActorDefs from './types/chat/bsky/actor/defs.js'
export * as ChatBskyActorDeleteAccount from './types/chat/bsky/actor/deleteAccount.js'
export * as ChatBskyActorExportAccountData from './types/chat/bsky/actor/exportAccountData.js'
export * as ChatBskyConvoAcceptConvo from './types/chat/bsky/convo/acceptConvo.js'
export * as ChatBskyConvoAddReaction from './types/chat/bsky/convo/addReaction.js'
export * as ChatBskyConvoDefs from './types/chat/bsky/convo/defs.js'
export * as ChatBskyConvoDeleteMessageForSelf from './types/chat/bsky/convo/deleteMessageForSelf.js'
export * as ChatBskyConvoGetConvo from './types/chat/bsky/convo/getConvo.js'
export * as ChatBskyConvoGetConvoAvailability from './types/chat/bsky/convo/getConvoAvailability.js'
export * as ChatBskyConvoGetConvoForMembers from './types/chat/bsky/convo/getConvoForMembers.js'
export * as ChatBskyConvoGetLog from './types/chat/bsky/convo/getLog.js'
export * as ChatBskyConvoGetMessages from './types/chat/bsky/convo/getMessages.js'
export * as ChatBskyConvoLeaveConvo from './types/chat/bsky/convo/leaveConvo.js'
export * as ChatBskyConvoListConvos from './types/chat/bsky/convo/listConvos.js'
export * as ChatBskyConvoMuteConvo from './types/chat/bsky/convo/muteConvo.js'
export * as ChatBskyConvoRemoveReaction from './types/chat/bsky/convo/removeReaction.js'
export * as ChatBskyConvoSendMessage from './types/chat/bsky/convo/sendMessage.js'
export * as ChatBskyConvoSendMessageBatch from './types/chat/bsky/convo/sendMessageBatch.js'
export * as ChatBskyConvoUnmuteConvo from './types/chat/bsky/convo/unmuteConvo.js'
export * as ChatBskyConvoUpdateAllRead from './types/chat/bsky/convo/updateAllRead.js'
export * as ChatBskyConvoUpdateRead from './types/chat/bsky/convo/updateRead.js'
export * as ChatBskyModerationGetActorMetadata from './types/chat/bsky/moderation/getActorMetadata.js'
export * as ChatBskyModerationGetMessageContext from './types/chat/bsky/moderation/getMessageContext.js'
export * as ChatBskyModerationUpdateActorAccess from './types/chat/bsky/moderation/updateActorAccess.js'
export * as ComAtprotoAdminDefs from './types/com/atproto/admin/defs.js'
export * as ComAtprotoAdminDeleteAccount from './types/com/atproto/admin/deleteAccount.js'
export * as ComAtprotoAdminDisableAccountInvites from './types/com/atproto/admin/disableAccountInvites.js'
export * as ComAtprotoAdminDisableInviteCodes from './types/com/atproto/admin/disableInviteCodes.js'
export * as ComAtprotoAdminEnableAccountInvites from './types/com/atproto/admin/enableAccountInvites.js'
export * as ComAtprotoAdminGetAccountInfo from './types/com/atproto/admin/getAccountInfo.js'
export * as ComAtprotoAdminGetAccountInfos from './types/com/atproto/admin/getAccountInfos.js'
export * as ComAtprotoAdminGetInviteCodes from './types/com/atproto/admin/getInviteCodes.js'
export * as ComAtprotoAdminGetSubjectStatus from './types/com/atproto/admin/getSubjectStatus.js'
export * as ComAtprotoAdminSearchAccounts from './types/com/atproto/admin/searchAccounts.js'
export * as ComAtprotoAdminSendEmail from './types/com/atproto/admin/sendEmail.js'
export * as ComAtprotoAdminUpdateAccountEmail from './types/com/atproto/admin/updateAccountEmail.js'
export * as ComAtprotoAdminUpdateAccountHandle from './types/com/atproto/admin/updateAccountHandle.js'
export * as ComAtprotoAdminUpdateAccountPassword from './types/com/atproto/admin/updateAccountPassword.js'
export * as ComAtprotoAdminUpdateAccountSigningKey from './types/com/atproto/admin/updateAccountSigningKey.js'
export * as ComAtprotoAdminUpdateSubjectStatus from './types/com/atproto/admin/updateSubjectStatus.js'
export * as ComAtprotoIdentityDefs from './types/com/atproto/identity/defs.js'
export * as ComAtprotoIdentityGetRecommendedDidCredentials from './types/com/atproto/identity/getRecommendedDidCredentials.js'
export * as ComAtprotoIdentityRefreshIdentity from './types/com/atproto/identity/refreshIdentity.js'
export * as ComAtprotoIdentityRequestPlcOperationSignature from './types/com/atproto/identity/requestPlcOperationSignature.js'
export * as ComAtprotoIdentityResolveDid from './types/com/atproto/identity/resolveDid.js'
export * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle.js'
export * as ComAtprotoIdentityResolveIdentity from './types/com/atproto/identity/resolveIdentity.js'
export * as ComAtprotoIdentitySignPlcOperation from './types/com/atproto/identity/signPlcOperation.js'
export * as ComAtprotoIdentitySubmitPlcOperation from './types/com/atproto/identity/submitPlcOperation.js'
export * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle.js'
export * as ComAtprotoLabelDefs from './types/com/atproto/label/defs.js'
export * as ComAtprotoLabelQueryLabels from './types/com/atproto/label/queryLabels.js'
export * as ComAtprotoLabelSubscribeLabels from './types/com/atproto/label/subscribeLabels.js'
export * as ComAtprotoLexiconSchema from './types/com/atproto/lexicon/schema.js'
export * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport.js'
export * as ComAtprotoModerationDefs from './types/com/atproto/moderation/defs.js'
export * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites.js'
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord.js'
export * as ComAtprotoRepoDefs from './types/com/atproto/repo/defs.js'
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord.js'
export * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo.js'
export * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord.js'
export * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo.js'
export * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs.js'
export * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords.js'
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord.js'
export * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef.js'
export * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob.js'
export * as ComAtprotoServerActivateAccount from './types/com/atproto/server/activateAccount.js'
export * as ComAtprotoServerCheckAccountStatus from './types/com/atproto/server/checkAccountStatus.js'
export * as ComAtprotoServerConfirmEmail from './types/com/atproto/server/confirmEmail.js'
export * as ComAtprotoServerCreateAccount from './types/com/atproto/server/createAccount.js'
export * as ComAtprotoServerCreateAppPassword from './types/com/atproto/server/createAppPassword.js'
export * as ComAtprotoServerCreateInviteCode from './types/com/atproto/server/createInviteCode.js'
export * as ComAtprotoServerCreateInviteCodes from './types/com/atproto/server/createInviteCodes.js'
export * as ComAtprotoServerCreateSession from './types/com/atproto/server/createSession.js'
export * as ComAtprotoServerDeactivateAccount from './types/com/atproto/server/deactivateAccount.js'
export * as ComAtprotoServerDefs from './types/com/atproto/server/defs.js'
export * as ComAtprotoServerDeleteAccount from './types/com/atproto/server/deleteAccount.js'
export * as ComAtprotoServerDeleteSession from './types/com/atproto/server/deleteSession.js'
export * as ComAtprotoServerDescribeServer from './types/com/atproto/server/describeServer.js'
export * as ComAtprotoServerGetAccountInviteCodes from './types/com/atproto/server/getAccountInviteCodes.js'
export * as ComAtprotoServerGetServiceAuth from './types/com/atproto/server/getServiceAuth.js'
export * as ComAtprotoServerGetSession from './types/com/atproto/server/getSession.js'
export * as ComAtprotoServerListAppPasswords from './types/com/atproto/server/listAppPasswords.js'
export * as ComAtprotoServerRefreshSession from './types/com/atproto/server/refreshSession.js'
export * as ComAtprotoServerRequestAccountDelete from './types/com/atproto/server/requestAccountDelete.js'
export * as ComAtprotoServerRequestEmailConfirmation from './types/com/atproto/server/requestEmailConfirmation.js'
export * as ComAtprotoServerRequestEmailUpdate from './types/com/atproto/server/requestEmailUpdate.js'
export * as ComAtprotoServerRequestPasswordReset from './types/com/atproto/server/requestPasswordReset.js'
export * as ComAtprotoServerReserveSigningKey from './types/com/atproto/server/reserveSigningKey.js'
export * as ComAtprotoServerResetPassword from './types/com/atproto/server/resetPassword.js'
export * as ComAtprotoServerRevokeAppPassword from './types/com/atproto/server/revokeAppPassword.js'
export * as ComAtprotoServerUpdateEmail from './types/com/atproto/server/updateEmail.js'
export * as ComAtprotoSyncDefs from './types/com/atproto/sync/defs.js'
export * as ComAtprotoSyncGetBlob from './types/com/atproto/sync/getBlob.js'
export * as ComAtprotoSyncGetBlocks from './types/com/atproto/sync/getBlocks.js'
export * as ComAtprotoSyncGetCheckout from './types/com/atproto/sync/getCheckout.js'
export * as ComAtprotoSyncGetHead from './types/com/atproto/sync/getHead.js'
export * as ComAtprotoSyncGetHostStatus from './types/com/atproto/sync/getHostStatus.js'
export * as ComAtprotoSyncGetLatestCommit from './types/com/atproto/sync/getLatestCommit.js'
export * as ComAtprotoSyncGetRecord from './types/com/atproto/sync/getRecord.js'
export * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo.js'
export * as ComAtprotoSyncGetRepoStatus from './types/com/atproto/sync/getRepoStatus.js'
export * as ComAtprotoSyncListBlobs from './types/com/atproto/sync/listBlobs.js'
export * as ComAtprotoSyncListHosts from './types/com/atproto/sync/listHosts.js'
export * as ComAtprotoSyncListRepos from './types/com/atproto/sync/listRepos.js'
export * as ComAtprotoSyncListReposByCollection from './types/com/atproto/sync/listReposByCollection.js'
export * as ComAtprotoSyncNotifyOfUpdate from './types/com/atproto/sync/notifyOfUpdate.js'
export * as ComAtprotoSyncRequestCrawl from './types/com/atproto/sync/requestCrawl.js'
export * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos.js'
export * as ComAtprotoTempAddReservedHandle from './types/com/atproto/temp/addReservedHandle.js'
export * as ComAtprotoTempCheckHandleAvailability from './types/com/atproto/temp/checkHandleAvailability.js'
export * as ComAtprotoTempCheckSignupQueue from './types/com/atproto/temp/checkSignupQueue.js'
export * as ComAtprotoTempFetchLabels from './types/com/atproto/temp/fetchLabels.js'
export * as ComAtprotoTempRequestPhoneVerification from './types/com/atproto/temp/requestPhoneVerification.js'
export * as ToolsOzoneCommunicationCreateTemplate from './types/tools/ozone/communication/createTemplate.js'
export * as ToolsOzoneCommunicationDefs from './types/tools/ozone/communication/defs.js'
export * as ToolsOzoneCommunicationDeleteTemplate from './types/tools/ozone/communication/deleteTemplate.js'
export * as ToolsOzoneCommunicationListTemplates from './types/tools/ozone/communication/listTemplates.js'
export * as ToolsOzoneCommunicationUpdateTemplate from './types/tools/ozone/communication/updateTemplate.js'
export * as ToolsOzoneHostingGetAccountHistory from './types/tools/ozone/hosting/getAccountHistory.js'
export * as ToolsOzoneModerationDefs from './types/tools/ozone/moderation/defs.js'
export * as ToolsOzoneModerationEmitEvent from './types/tools/ozone/moderation/emitEvent.js'
export * as ToolsOzoneModerationGetAccountTimeline from './types/tools/ozone/moderation/getAccountTimeline.js'
export * as ToolsOzoneModerationGetEvent from './types/tools/ozone/moderation/getEvent.js'
export * as ToolsOzoneModerationGetRecord from './types/tools/ozone/moderation/getRecord.js'
export * as ToolsOzoneModerationGetRecords from './types/tools/ozone/moderation/getRecords.js'
export * as ToolsOzoneModerationGetRepo from './types/tools/ozone/moderation/getRepo.js'
export * as ToolsOzoneModerationGetReporterStats from './types/tools/ozone/moderation/getReporterStats.js'
export * as ToolsOzoneModerationGetRepos from './types/tools/ozone/moderation/getRepos.js'
export * as ToolsOzoneModerationGetSubjects from './types/tools/ozone/moderation/getSubjects.js'
export * as ToolsOzoneModerationQueryEvents from './types/tools/ozone/moderation/queryEvents.js'
export * as ToolsOzoneModerationQueryStatuses from './types/tools/ozone/moderation/queryStatuses.js'
export * as ToolsOzoneModerationSearchRepos from './types/tools/ozone/moderation/searchRepos.js'
export * as ToolsOzoneSafelinkAddRule from './types/tools/ozone/safelink/addRule.js'
export * as ToolsOzoneSafelinkDefs from './types/tools/ozone/safelink/defs.js'
export * as ToolsOzoneSafelinkQueryEvents from './types/tools/ozone/safelink/queryEvents.js'
export * as ToolsOzoneSafelinkQueryRules from './types/tools/ozone/safelink/queryRules.js'
export * as ToolsOzoneSafelinkRemoveRule from './types/tools/ozone/safelink/removeRule.js'
export * as ToolsOzoneSafelinkUpdateRule from './types/tools/ozone/safelink/updateRule.js'
export * as ToolsOzoneServerGetConfig from './types/tools/ozone/server/getConfig.js'
export * as ToolsOzoneSetAddValues from './types/tools/ozone/set/addValues.js'
export * as ToolsOzoneSetDefs from './types/tools/ozone/set/defs.js'
export * as ToolsOzoneSetDeleteSet from './types/tools/ozone/set/deleteSet.js'
export * as ToolsOzoneSetDeleteValues from './types/tools/ozone/set/deleteValues.js'
export * as ToolsOzoneSetGetValues from './types/tools/ozone/set/getValues.js'
export * as ToolsOzoneSetQuerySets from './types/tools/ozone/set/querySets.js'
export * as ToolsOzoneSetUpsertSet from './types/tools/ozone/set/upsertSet.js'
export * as ToolsOzoneSettingDefs from './types/tools/ozone/setting/defs.js'
export * as ToolsOzoneSettingListOptions from './types/tools/ozone/setting/listOptions.js'
export * as ToolsOzoneSettingRemoveOptions from './types/tools/ozone/setting/removeOptions.js'
export * as ToolsOzoneSettingUpsertOption from './types/tools/ozone/setting/upsertOption.js'
export * as ToolsOzoneSignatureDefs from './types/tools/ozone/signature/defs.js'
export * as ToolsOzoneSignatureFindCorrelation from './types/tools/ozone/signature/findCorrelation.js'
export * as ToolsOzoneSignatureFindRelatedAccounts from './types/tools/ozone/signature/findRelatedAccounts.js'
export * as ToolsOzoneSignatureSearchAccounts from './types/tools/ozone/signature/searchAccounts.js'
export * as ToolsOzoneTeamAddMember from './types/tools/ozone/team/addMember.js'
export * as ToolsOzoneTeamDefs from './types/tools/ozone/team/defs.js'
export * as ToolsOzoneTeamDeleteMember from './types/tools/ozone/team/deleteMember.js'
export * as ToolsOzoneTeamListMembers from './types/tools/ozone/team/listMembers.js'
export * as ToolsOzoneTeamUpdateMember from './types/tools/ozone/team/updateMember.js'
export * as ToolsOzoneVerificationDefs from './types/tools/ozone/verification/defs.js'
export * as ToolsOzoneVerificationGrantVerifications from './types/tools/ozone/verification/grantVerifications.js'
export * as ToolsOzoneVerificationListVerifications from './types/tools/ozone/verification/listVerifications.js'
export * as ToolsOzoneVerificationRevokeVerifications from './types/tools/ozone/verification/revokeVerifications.js'

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
export const TOOLS_OZONE_MODERATION = {
  DefsReviewOpen: 'tools.ozone.moderation.defs#reviewOpen',
  DefsReviewEscalated: 'tools.ozone.moderation.defs#reviewEscalated',
  DefsReviewClosed: 'tools.ozone.moderation.defs#reviewClosed',
  DefsReviewNone: 'tools.ozone.moderation.defs#reviewNone',
  DefsTimelineEventPlcCreate:
    'tools.ozone.moderation.defs#timelineEventPlcCreate',
  DefsTimelineEventPlcOperation:
    'tools.ozone.moderation.defs#timelineEventPlcOperation',
  DefsTimelineEventPlcTombstone:
    'tools.ozone.moderation.defs#timelineEventPlcTombstone',
}
export const TOOLS_OZONE_TEAM = {
  DefsRoleAdmin: 'tools.ozone.team.defs#roleAdmin',
  DefsRoleModerator: 'tools.ozone.team.defs#roleModerator',
  DefsRoleTriage: 'tools.ozone.team.defs#roleTriage',
  DefsRoleVerifier: 'tools.ozone.team.defs#roleVerifier',
}

export class AtpBaseClient extends XrpcClient {
  app: AppNS
  chat: ChatNS
  com: ComNS
  tools: ToolsNS

  constructor(options: FetchHandler | FetchHandlerOptions) {
    super(options, schemas)
    this.app = new AppNS(this)
    this.chat = new ChatNS(this)
    this.com = new ComNS(this)
    this.tools = new ToolsNS(this)
  }

  /** @deprecated use `this` instead */
  get xrpc(): XrpcClient {
    return this
  }
}

export * from './ns/app/index.js'
export * from './ns/chat/index.js'
export * from './ns/com/index.js'
export * from './ns/tools/index.js'

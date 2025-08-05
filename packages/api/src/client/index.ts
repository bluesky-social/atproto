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
import * as ComAtprotoAdminDefs from './types/com/atproto/admin/defs.js'
import * as ComAtprotoAdminDeleteAccount from './types/com/atproto/admin/deleteAccount.js'
import * as ComAtprotoAdminDisableAccountInvites from './types/com/atproto/admin/disableAccountInvites.js'
import * as ComAtprotoAdminDisableInviteCodes from './types/com/atproto/admin/disableInviteCodes.js'
import * as ComAtprotoAdminEnableAccountInvites from './types/com/atproto/admin/enableAccountInvites.js'
import * as ComAtprotoAdminGetAccountInfo from './types/com/atproto/admin/getAccountInfo.js'
import * as ComAtprotoAdminGetAccountInfos from './types/com/atproto/admin/getAccountInfos.js'
import * as ComAtprotoAdminGetInviteCodes from './types/com/atproto/admin/getInviteCodes.js'
import * as ComAtprotoAdminGetSubjectStatus from './types/com/atproto/admin/getSubjectStatus.js'
import * as ComAtprotoAdminSearchAccounts from './types/com/atproto/admin/searchAccounts.js'
import * as ComAtprotoAdminSendEmail from './types/com/atproto/admin/sendEmail.js'
import * as ComAtprotoAdminUpdateAccountEmail from './types/com/atproto/admin/updateAccountEmail.js'
import * as ComAtprotoAdminUpdateAccountHandle from './types/com/atproto/admin/updateAccountHandle.js'
import * as ComAtprotoAdminUpdateAccountPassword from './types/com/atproto/admin/updateAccountPassword.js'
import * as ComAtprotoAdminUpdateAccountSigningKey from './types/com/atproto/admin/updateAccountSigningKey.js'
import * as ComAtprotoAdminUpdateSubjectStatus from './types/com/atproto/admin/updateSubjectStatus.js'
import * as ComAtprotoIdentityDefs from './types/com/atproto/identity/defs.js'
import * as ComAtprotoIdentityGetRecommendedDidCredentials from './types/com/atproto/identity/getRecommendedDidCredentials.js'
import * as ComAtprotoIdentityRefreshIdentity from './types/com/atproto/identity/refreshIdentity.js'
import * as ComAtprotoIdentityRequestPlcOperationSignature from './types/com/atproto/identity/requestPlcOperationSignature.js'
import * as ComAtprotoIdentityResolveDid from './types/com/atproto/identity/resolveDid.js'
import * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle.js'
import * as ComAtprotoIdentityResolveIdentity from './types/com/atproto/identity/resolveIdentity.js'
import * as ComAtprotoIdentitySignPlcOperation from './types/com/atproto/identity/signPlcOperation.js'
import * as ComAtprotoIdentitySubmitPlcOperation from './types/com/atproto/identity/submitPlcOperation.js'
import * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle.js'
import * as ComAtprotoLabelDefs from './types/com/atproto/label/defs.js'
import * as ComAtprotoLabelQueryLabels from './types/com/atproto/label/queryLabels.js'
import * as ComAtprotoLabelSubscribeLabels from './types/com/atproto/label/subscribeLabels.js'
import * as ComAtprotoLexiconSchema from './types/com/atproto/lexicon/schema.js'
import * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport.js'
import * as ComAtprotoModerationDefs from './types/com/atproto/moderation/defs.js'
import * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites.js'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDefs from './types/com/atproto/repo/defs.js'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo.js'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo.js'
import * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs.js'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord.js'
import * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef.js'
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
import * as ComAtprotoServerDefs from './types/com/atproto/server/defs.js'
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
import * as ComAtprotoSyncDefs from './types/com/atproto/sync/defs.js'
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
import * as ComAtprotoTempFetchLabels from './types/com/atproto/temp/fetchLabels.js'
import * as ComAtprotoTempRequestPhoneVerification from './types/com/atproto/temp/requestPhoneVerification.js'
import * as AppBskyActorDefs from './types/app/bsky/actor/defs.js'
import * as AppBskyActorGetPreferences from './types/app/bsky/actor/getPreferences.js'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile.js'
import * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles.js'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions.js'
import * as AppBskyActorProfile from './types/app/bsky/actor/profile.js'
import * as AppBskyActorPutPreferences from './types/app/bsky/actor/putPreferences.js'
import * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors.js'
import * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead.js'
import * as AppBskyActorStatus from './types/app/bsky/actor/status.js'
import * as AppBskyEmbedDefs from './types/app/bsky/embed/defs.js'
import * as AppBskyEmbedExternal from './types/app/bsky/embed/external.js'
import * as AppBskyEmbedImages from './types/app/bsky/embed/images.js'
import * as AppBskyEmbedRecord from './types/app/bsky/embed/record.js'
import * as AppBskyEmbedRecordWithMedia from './types/app/bsky/embed/recordWithMedia.js'
import * as AppBskyEmbedVideo from './types/app/bsky/embed/video.js'
import * as AppBskyFeedDefs from './types/app/bsky/feed/defs.js'
import * as AppBskyFeedDescribeFeedGenerator from './types/app/bsky/feed/describeFeedGenerator.js'
import * as AppBskyFeedGenerator from './types/app/bsky/feed/generator.js'
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
import * as AppBskyFeedLike from './types/app/bsky/feed/like.js'
import * as AppBskyFeedPost from './types/app/bsky/feed/post.js'
import * as AppBskyFeedPostgate from './types/app/bsky/feed/postgate.js'
import * as AppBskyFeedRepost from './types/app/bsky/feed/repost.js'
import * as AppBskyFeedSearchPosts from './types/app/bsky/feed/searchPosts.js'
import * as AppBskyFeedSendInteractions from './types/app/bsky/feed/sendInteractions.js'
import * as AppBskyFeedThreadgate from './types/app/bsky/feed/threadgate.js'
import * as AppBskyGraphBlock from './types/app/bsky/graph/block.js'
import * as AppBskyGraphDefs from './types/app/bsky/graph/defs.js'
import * as AppBskyGraphFollow from './types/app/bsky/graph/follow.js'
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
import * as AppBskyGraphList from './types/app/bsky/graph/list.js'
import * as AppBskyGraphListblock from './types/app/bsky/graph/listblock.js'
import * as AppBskyGraphListitem from './types/app/bsky/graph/listitem.js'
import * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor.js'
import * as AppBskyGraphMuteActorList from './types/app/bsky/graph/muteActorList.js'
import * as AppBskyGraphMuteThread from './types/app/bsky/graph/muteThread.js'
import * as AppBskyGraphSearchStarterPacks from './types/app/bsky/graph/searchStarterPacks.js'
import * as AppBskyGraphStarterpack from './types/app/bsky/graph/starterpack.js'
import * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor.js'
import * as AppBskyGraphUnmuteActorList from './types/app/bsky/graph/unmuteActorList.js'
import * as AppBskyGraphUnmuteThread from './types/app/bsky/graph/unmuteThread.js'
import * as AppBskyGraphVerification from './types/app/bsky/graph/verification.js'
import * as AppBskyLabelerDefs from './types/app/bsky/labeler/defs.js'
import * as AppBskyLabelerGetServices from './types/app/bsky/labeler/getServices.js'
import * as AppBskyLabelerService from './types/app/bsky/labeler/service.js'
import * as AppBskyNotificationDeclaration from './types/app/bsky/notification/declaration.js'
import * as AppBskyNotificationDefs from './types/app/bsky/notification/defs.js'
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
import * as AppBskyRichtextFacet from './types/app/bsky/richtext/facet.js'
import * as AppBskyUnspeccedDefs from './types/app/bsky/unspecced/defs.js'
import * as AppBskyUnspeccedGetAgeAssuranceState from './types/app/bsky/unspecced/getAgeAssuranceState.js'
import * as AppBskyUnspeccedGetConfig from './types/app/bsky/unspecced/getConfig.js'
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
import * as AppBskyVideoDefs from './types/app/bsky/video/defs.js'
import * as AppBskyVideoGetJobStatus from './types/app/bsky/video/getJobStatus.js'
import * as AppBskyVideoGetUploadLimits from './types/app/bsky/video/getUploadLimits.js'
import * as AppBskyVideoUploadVideo from './types/app/bsky/video/uploadVideo.js'
import * as ChatBskyActorDeclaration from './types/chat/bsky/actor/declaration.js'
import * as ChatBskyActorDefs from './types/chat/bsky/actor/defs.js'
import * as ChatBskyActorDeleteAccount from './types/chat/bsky/actor/deleteAccount.js'
import * as ChatBskyActorExportAccountData from './types/chat/bsky/actor/exportAccountData.js'
import * as ChatBskyConvoAcceptConvo from './types/chat/bsky/convo/acceptConvo.js'
import * as ChatBskyConvoAddReaction from './types/chat/bsky/convo/addReaction.js'
import * as ChatBskyConvoDefs from './types/chat/bsky/convo/defs.js'
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
import * as ToolsOzoneCommunicationCreateTemplate from './types/tools/ozone/communication/createTemplate.js'
import * as ToolsOzoneCommunicationDefs from './types/tools/ozone/communication/defs.js'
import * as ToolsOzoneCommunicationDeleteTemplate from './types/tools/ozone/communication/deleteTemplate.js'
import * as ToolsOzoneCommunicationListTemplates from './types/tools/ozone/communication/listTemplates.js'
import * as ToolsOzoneCommunicationUpdateTemplate from './types/tools/ozone/communication/updateTemplate.js'
import * as ToolsOzoneHostingGetAccountHistory from './types/tools/ozone/hosting/getAccountHistory.js'
import * as ToolsOzoneModerationDefs from './types/tools/ozone/moderation/defs.js'
import * as ToolsOzoneModerationEmitEvent from './types/tools/ozone/moderation/emitEvent.js'
import * as ToolsOzoneModerationGetAccountTimeline from './types/tools/ozone/moderation/getAccountTimeline.js'
import * as ToolsOzoneModerationGetEvent from './types/tools/ozone/moderation/getEvent.js'
import * as ToolsOzoneModerationGetRecord from './types/tools/ozone/moderation/getRecord.js'
import * as ToolsOzoneModerationGetRecords from './types/tools/ozone/moderation/getRecords.js'
import * as ToolsOzoneModerationGetRepo from './types/tools/ozone/moderation/getRepo.js'
import * as ToolsOzoneModerationGetReporterStats from './types/tools/ozone/moderation/getReporterStats.js'
import * as ToolsOzoneModerationGetRepos from './types/tools/ozone/moderation/getRepos.js'
import * as ToolsOzoneModerationGetSubjects from './types/tools/ozone/moderation/getSubjects.js'
import * as ToolsOzoneModerationQueryEvents from './types/tools/ozone/moderation/queryEvents.js'
import * as ToolsOzoneModerationQueryStatuses from './types/tools/ozone/moderation/queryStatuses.js'
import * as ToolsOzoneModerationSearchRepos from './types/tools/ozone/moderation/searchRepos.js'
import * as ToolsOzoneSafelinkAddRule from './types/tools/ozone/safelink/addRule.js'
import * as ToolsOzoneSafelinkDefs from './types/tools/ozone/safelink/defs.js'
import * as ToolsOzoneSafelinkQueryEvents from './types/tools/ozone/safelink/queryEvents.js'
import * as ToolsOzoneSafelinkQueryRules from './types/tools/ozone/safelink/queryRules.js'
import * as ToolsOzoneSafelinkRemoveRule from './types/tools/ozone/safelink/removeRule.js'
import * as ToolsOzoneSafelinkUpdateRule from './types/tools/ozone/safelink/updateRule.js'
import * as ToolsOzoneServerGetConfig from './types/tools/ozone/server/getConfig.js'
import * as ToolsOzoneSetAddValues from './types/tools/ozone/set/addValues.js'
import * as ToolsOzoneSetDefs from './types/tools/ozone/set/defs.js'
import * as ToolsOzoneSetDeleteSet from './types/tools/ozone/set/deleteSet.js'
import * as ToolsOzoneSetDeleteValues from './types/tools/ozone/set/deleteValues.js'
import * as ToolsOzoneSetGetValues from './types/tools/ozone/set/getValues.js'
import * as ToolsOzoneSetQuerySets from './types/tools/ozone/set/querySets.js'
import * as ToolsOzoneSetUpsertSet from './types/tools/ozone/set/upsertSet.js'
import * as ToolsOzoneSettingDefs from './types/tools/ozone/setting/defs.js'
import * as ToolsOzoneSettingListOptions from './types/tools/ozone/setting/listOptions.js'
import * as ToolsOzoneSettingRemoveOptions from './types/tools/ozone/setting/removeOptions.js'
import * as ToolsOzoneSettingUpsertOption from './types/tools/ozone/setting/upsertOption.js'
import * as ToolsOzoneSignatureDefs from './types/tools/ozone/signature/defs.js'
import * as ToolsOzoneSignatureFindCorrelation from './types/tools/ozone/signature/findCorrelation.js'
import * as ToolsOzoneSignatureFindRelatedAccounts from './types/tools/ozone/signature/findRelatedAccounts.js'
import * as ToolsOzoneSignatureSearchAccounts from './types/tools/ozone/signature/searchAccounts.js'
import * as ToolsOzoneTeamAddMember from './types/tools/ozone/team/addMember.js'
import * as ToolsOzoneTeamDefs from './types/tools/ozone/team/defs.js'
import * as ToolsOzoneTeamDeleteMember from './types/tools/ozone/team/deleteMember.js'
import * as ToolsOzoneTeamListMembers from './types/tools/ozone/team/listMembers.js'
import * as ToolsOzoneTeamUpdateMember from './types/tools/ozone/team/updateMember.js'
import * as ToolsOzoneVerificationDefs from './types/tools/ozone/verification/defs.js'
import * as ToolsOzoneVerificationGrantVerifications from './types/tools/ozone/verification/grantVerifications.js'
import * as ToolsOzoneVerificationListVerifications from './types/tools/ozone/verification/listVerifications.js'
import * as ToolsOzoneVerificationRevokeVerifications from './types/tools/ozone/verification/revokeVerifications.js'

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

export const COM_ATPROTO_MODERATION = {
  DefsReasonSpam: 'com.atproto.moderation.defs#reasonSpam',
  DefsReasonViolation: 'com.atproto.moderation.defs#reasonViolation',
  DefsReasonMisleading: 'com.atproto.moderation.defs#reasonMisleading',
  DefsReasonSexual: 'com.atproto.moderation.defs#reasonSexual',
  DefsReasonRude: 'com.atproto.moderation.defs#reasonRude',
  DefsReasonOther: 'com.atproto.moderation.defs#reasonOther',
  DefsReasonAppeal: 'com.atproto.moderation.defs#reasonAppeal',
}
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
  com: ComNS
  app: AppNS
  chat: ChatNS
  tools: ToolsNS

  constructor(options: FetchHandler | FetchHandlerOptions) {
    super(options, schemas)
    this.com = new ComNS(this)
    this.app = new AppNS(this)
    this.chat = new ChatNS(this)
    this.tools = new ToolsNS(this)
  }

  /** @deprecated use `this` instead */
  get xrpc(): XrpcClient {
    return this
  }
}

export class ComNS {
  _client: XrpcClient
  atproto: ComAtprotoNS

  constructor(client: XrpcClient) {
    this._client = client
    this.atproto = new ComAtprotoNS(client)
  }
}

export class ComAtprotoNS {
  _client: XrpcClient
  admin: ComAtprotoAdminNS
  identity: ComAtprotoIdentityNS
  label: ComAtprotoLabelNS
  lexicon: ComAtprotoLexiconNS
  moderation: ComAtprotoModerationNS
  repo: ComAtprotoRepoNS
  server: ComAtprotoServerNS
  sync: ComAtprotoSyncNS
  temp: ComAtprotoTempNS

  constructor(client: XrpcClient) {
    this._client = client
    this.admin = new ComAtprotoAdminNS(client)
    this.identity = new ComAtprotoIdentityNS(client)
    this.label = new ComAtprotoLabelNS(client)
    this.lexicon = new ComAtprotoLexiconNS(client)
    this.moderation = new ComAtprotoModerationNS(client)
    this.repo = new ComAtprotoRepoNS(client)
    this.server = new ComAtprotoServerNS(client)
    this.sync = new ComAtprotoSyncNS(client)
    this.temp = new ComAtprotoTempNS(client)
  }
}

export class ComAtprotoAdminNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  deleteAccount(
    data?: ComAtprotoAdminDeleteAccount.InputSchema,
    opts?: ComAtprotoAdminDeleteAccount.CallOptions,
  ): Promise<ComAtprotoAdminDeleteAccount.Response> {
    return this._client.call(
      'com.atproto.admin.deleteAccount',
      opts?.qp,
      data,
      opts,
    )
  }

  disableAccountInvites(
    data?: ComAtprotoAdminDisableAccountInvites.InputSchema,
    opts?: ComAtprotoAdminDisableAccountInvites.CallOptions,
  ): Promise<ComAtprotoAdminDisableAccountInvites.Response> {
    return this._client.call(
      'com.atproto.admin.disableAccountInvites',
      opts?.qp,
      data,
      opts,
    )
  }

  disableInviteCodes(
    data?: ComAtprotoAdminDisableInviteCodes.InputSchema,
    opts?: ComAtprotoAdminDisableInviteCodes.CallOptions,
  ): Promise<ComAtprotoAdminDisableInviteCodes.Response> {
    return this._client.call(
      'com.atproto.admin.disableInviteCodes',
      opts?.qp,
      data,
      opts,
    )
  }

  enableAccountInvites(
    data?: ComAtprotoAdminEnableAccountInvites.InputSchema,
    opts?: ComAtprotoAdminEnableAccountInvites.CallOptions,
  ): Promise<ComAtprotoAdminEnableAccountInvites.Response> {
    return this._client.call(
      'com.atproto.admin.enableAccountInvites',
      opts?.qp,
      data,
      opts,
    )
  }

  getAccountInfo(
    params?: ComAtprotoAdminGetAccountInfo.QueryParams,
    opts?: ComAtprotoAdminGetAccountInfo.CallOptions,
  ): Promise<ComAtprotoAdminGetAccountInfo.Response> {
    return this._client.call(
      'com.atproto.admin.getAccountInfo',
      params,
      undefined,
      opts,
    )
  }

  getAccountInfos(
    params?: ComAtprotoAdminGetAccountInfos.QueryParams,
    opts?: ComAtprotoAdminGetAccountInfos.CallOptions,
  ): Promise<ComAtprotoAdminGetAccountInfos.Response> {
    return this._client.call(
      'com.atproto.admin.getAccountInfos',
      params,
      undefined,
      opts,
    )
  }

  getInviteCodes(
    params?: ComAtprotoAdminGetInviteCodes.QueryParams,
    opts?: ComAtprotoAdminGetInviteCodes.CallOptions,
  ): Promise<ComAtprotoAdminGetInviteCodes.Response> {
    return this._client.call(
      'com.atproto.admin.getInviteCodes',
      params,
      undefined,
      opts,
    )
  }

  getSubjectStatus(
    params?: ComAtprotoAdminGetSubjectStatus.QueryParams,
    opts?: ComAtprotoAdminGetSubjectStatus.CallOptions,
  ): Promise<ComAtprotoAdminGetSubjectStatus.Response> {
    return this._client.call(
      'com.atproto.admin.getSubjectStatus',
      params,
      undefined,
      opts,
    )
  }

  searchAccounts(
    params?: ComAtprotoAdminSearchAccounts.QueryParams,
    opts?: ComAtprotoAdminSearchAccounts.CallOptions,
  ): Promise<ComAtprotoAdminSearchAccounts.Response> {
    return this._client.call(
      'com.atproto.admin.searchAccounts',
      params,
      undefined,
      opts,
    )
  }

  sendEmail(
    data?: ComAtprotoAdminSendEmail.InputSchema,
    opts?: ComAtprotoAdminSendEmail.CallOptions,
  ): Promise<ComAtprotoAdminSendEmail.Response> {
    return this._client.call(
      'com.atproto.admin.sendEmail',
      opts?.qp,
      data,
      opts,
    )
  }

  updateAccountEmail(
    data?: ComAtprotoAdminUpdateAccountEmail.InputSchema,
    opts?: ComAtprotoAdminUpdateAccountEmail.CallOptions,
  ): Promise<ComAtprotoAdminUpdateAccountEmail.Response> {
    return this._client.call(
      'com.atproto.admin.updateAccountEmail',
      opts?.qp,
      data,
      opts,
    )
  }

  updateAccountHandle(
    data?: ComAtprotoAdminUpdateAccountHandle.InputSchema,
    opts?: ComAtprotoAdminUpdateAccountHandle.CallOptions,
  ): Promise<ComAtprotoAdminUpdateAccountHandle.Response> {
    return this._client.call(
      'com.atproto.admin.updateAccountHandle',
      opts?.qp,
      data,
      opts,
    )
  }

  updateAccountPassword(
    data?: ComAtprotoAdminUpdateAccountPassword.InputSchema,
    opts?: ComAtprotoAdminUpdateAccountPassword.CallOptions,
  ): Promise<ComAtprotoAdminUpdateAccountPassword.Response> {
    return this._client.call(
      'com.atproto.admin.updateAccountPassword',
      opts?.qp,
      data,
      opts,
    )
  }

  updateAccountSigningKey(
    data?: ComAtprotoAdminUpdateAccountSigningKey.InputSchema,
    opts?: ComAtprotoAdminUpdateAccountSigningKey.CallOptions,
  ): Promise<ComAtprotoAdminUpdateAccountSigningKey.Response> {
    return this._client.call(
      'com.atproto.admin.updateAccountSigningKey',
      opts?.qp,
      data,
      opts,
    )
  }

  updateSubjectStatus(
    data?: ComAtprotoAdminUpdateSubjectStatus.InputSchema,
    opts?: ComAtprotoAdminUpdateSubjectStatus.CallOptions,
  ): Promise<ComAtprotoAdminUpdateSubjectStatus.Response> {
    return this._client.call(
      'com.atproto.admin.updateSubjectStatus',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class ComAtprotoIdentityNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getRecommendedDidCredentials(
    params?: ComAtprotoIdentityGetRecommendedDidCredentials.QueryParams,
    opts?: ComAtprotoIdentityGetRecommendedDidCredentials.CallOptions,
  ): Promise<ComAtprotoIdentityGetRecommendedDidCredentials.Response> {
    return this._client.call(
      'com.atproto.identity.getRecommendedDidCredentials',
      params,
      undefined,
      opts,
    )
  }

  refreshIdentity(
    data?: ComAtprotoIdentityRefreshIdentity.InputSchema,
    opts?: ComAtprotoIdentityRefreshIdentity.CallOptions,
  ): Promise<ComAtprotoIdentityRefreshIdentity.Response> {
    return this._client
      .call('com.atproto.identity.refreshIdentity', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoIdentityRefreshIdentity.toKnownErr(e)
      })
  }

  requestPlcOperationSignature(
    data?: ComAtprotoIdentityRequestPlcOperationSignature.InputSchema,
    opts?: ComAtprotoIdentityRequestPlcOperationSignature.CallOptions,
  ): Promise<ComAtprotoIdentityRequestPlcOperationSignature.Response> {
    return this._client.call(
      'com.atproto.identity.requestPlcOperationSignature',
      opts?.qp,
      data,
      opts,
    )
  }

  resolveDid(
    params?: ComAtprotoIdentityResolveDid.QueryParams,
    opts?: ComAtprotoIdentityResolveDid.CallOptions,
  ): Promise<ComAtprotoIdentityResolveDid.Response> {
    return this._client
      .call('com.atproto.identity.resolveDid', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoIdentityResolveDid.toKnownErr(e)
      })
  }

  resolveHandle(
    params?: ComAtprotoIdentityResolveHandle.QueryParams,
    opts?: ComAtprotoIdentityResolveHandle.CallOptions,
  ): Promise<ComAtprotoIdentityResolveHandle.Response> {
    return this._client
      .call('com.atproto.identity.resolveHandle', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoIdentityResolveHandle.toKnownErr(e)
      })
  }

  resolveIdentity(
    params?: ComAtprotoIdentityResolveIdentity.QueryParams,
    opts?: ComAtprotoIdentityResolveIdentity.CallOptions,
  ): Promise<ComAtprotoIdentityResolveIdentity.Response> {
    return this._client
      .call('com.atproto.identity.resolveIdentity', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoIdentityResolveIdentity.toKnownErr(e)
      })
  }

  signPlcOperation(
    data?: ComAtprotoIdentitySignPlcOperation.InputSchema,
    opts?: ComAtprotoIdentitySignPlcOperation.CallOptions,
  ): Promise<ComAtprotoIdentitySignPlcOperation.Response> {
    return this._client.call(
      'com.atproto.identity.signPlcOperation',
      opts?.qp,
      data,
      opts,
    )
  }

  submitPlcOperation(
    data?: ComAtprotoIdentitySubmitPlcOperation.InputSchema,
    opts?: ComAtprotoIdentitySubmitPlcOperation.CallOptions,
  ): Promise<ComAtprotoIdentitySubmitPlcOperation.Response> {
    return this._client.call(
      'com.atproto.identity.submitPlcOperation',
      opts?.qp,
      data,
      opts,
    )
  }

  updateHandle(
    data?: ComAtprotoIdentityUpdateHandle.InputSchema,
    opts?: ComAtprotoIdentityUpdateHandle.CallOptions,
  ): Promise<ComAtprotoIdentityUpdateHandle.Response> {
    return this._client.call(
      'com.atproto.identity.updateHandle',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class ComAtprotoLabelNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  queryLabels(
    params?: ComAtprotoLabelQueryLabels.QueryParams,
    opts?: ComAtprotoLabelQueryLabels.CallOptions,
  ): Promise<ComAtprotoLabelQueryLabels.Response> {
    return this._client.call(
      'com.atproto.label.queryLabels',
      params,
      undefined,
      opts,
    )
  }
}

export class ComAtprotoLexiconNS {
  _client: XrpcClient
  schema: ComAtprotoLexiconSchemaRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.schema = new ComAtprotoLexiconSchemaRecord(client)
  }
}

export class ComAtprotoLexiconSchemaRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: ComAtprotoLexiconSchema.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'com.atproto.lexicon.schema',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: ComAtprotoLexiconSchema.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'com.atproto.lexicon.schema',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<ComAtprotoLexiconSchema.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'com.atproto.lexicon.schema'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<ComAtprotoLexiconSchema.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'com.atproto.lexicon.schema'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'com.atproto.lexicon.schema', ...params },
      { headers },
    )
  }
}

export class ComAtprotoModerationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  createReport(
    data?: ComAtprotoModerationCreateReport.InputSchema,
    opts?: ComAtprotoModerationCreateReport.CallOptions,
  ): Promise<ComAtprotoModerationCreateReport.Response> {
    return this._client.call(
      'com.atproto.moderation.createReport',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class ComAtprotoRepoNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  applyWrites(
    data?: ComAtprotoRepoApplyWrites.InputSchema,
    opts?: ComAtprotoRepoApplyWrites.CallOptions,
  ): Promise<ComAtprotoRepoApplyWrites.Response> {
    return this._client
      .call('com.atproto.repo.applyWrites', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoApplyWrites.toKnownErr(e)
      })
  }

  createRecord(
    data?: ComAtprotoRepoCreateRecord.InputSchema,
    opts?: ComAtprotoRepoCreateRecord.CallOptions,
  ): Promise<ComAtprotoRepoCreateRecord.Response> {
    return this._client
      .call('com.atproto.repo.createRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoCreateRecord.toKnownErr(e)
      })
  }

  deleteRecord(
    data?: ComAtprotoRepoDeleteRecord.InputSchema,
    opts?: ComAtprotoRepoDeleteRecord.CallOptions,
  ): Promise<ComAtprotoRepoDeleteRecord.Response> {
    return this._client
      .call('com.atproto.repo.deleteRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoDeleteRecord.toKnownErr(e)
      })
  }

  describeRepo(
    params?: ComAtprotoRepoDescribeRepo.QueryParams,
    opts?: ComAtprotoRepoDescribeRepo.CallOptions,
  ): Promise<ComAtprotoRepoDescribeRepo.Response> {
    return this._client.call(
      'com.atproto.repo.describeRepo',
      params,
      undefined,
      opts,
    )
  }

  getRecord(
    params?: ComAtprotoRepoGetRecord.QueryParams,
    opts?: ComAtprotoRepoGetRecord.CallOptions,
  ): Promise<ComAtprotoRepoGetRecord.Response> {
    return this._client
      .call('com.atproto.repo.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoGetRecord.toKnownErr(e)
      })
  }

  importRepo(
    data?: ComAtprotoRepoImportRepo.InputSchema,
    opts?: ComAtprotoRepoImportRepo.CallOptions,
  ): Promise<ComAtprotoRepoImportRepo.Response> {
    return this._client.call(
      'com.atproto.repo.importRepo',
      opts?.qp,
      data,
      opts,
    )
  }

  listMissingBlobs(
    params?: ComAtprotoRepoListMissingBlobs.QueryParams,
    opts?: ComAtprotoRepoListMissingBlobs.CallOptions,
  ): Promise<ComAtprotoRepoListMissingBlobs.Response> {
    return this._client.call(
      'com.atproto.repo.listMissingBlobs',
      params,
      undefined,
      opts,
    )
  }

  listRecords(
    params?: ComAtprotoRepoListRecords.QueryParams,
    opts?: ComAtprotoRepoListRecords.CallOptions,
  ): Promise<ComAtprotoRepoListRecords.Response> {
    return this._client.call(
      'com.atproto.repo.listRecords',
      params,
      undefined,
      opts,
    )
  }

  putRecord(
    data?: ComAtprotoRepoPutRecord.InputSchema,
    opts?: ComAtprotoRepoPutRecord.CallOptions,
  ): Promise<ComAtprotoRepoPutRecord.Response> {
    return this._client
      .call('com.atproto.repo.putRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoPutRecord.toKnownErr(e)
      })
  }

  uploadBlob(
    data?: ComAtprotoRepoUploadBlob.InputSchema,
    opts?: ComAtprotoRepoUploadBlob.CallOptions,
  ): Promise<ComAtprotoRepoUploadBlob.Response> {
    return this._client.call(
      'com.atproto.repo.uploadBlob',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class ComAtprotoServerNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  activateAccount(
    data?: ComAtprotoServerActivateAccount.InputSchema,
    opts?: ComAtprotoServerActivateAccount.CallOptions,
  ): Promise<ComAtprotoServerActivateAccount.Response> {
    return this._client.call(
      'com.atproto.server.activateAccount',
      opts?.qp,
      data,
      opts,
    )
  }

  checkAccountStatus(
    params?: ComAtprotoServerCheckAccountStatus.QueryParams,
    opts?: ComAtprotoServerCheckAccountStatus.CallOptions,
  ): Promise<ComAtprotoServerCheckAccountStatus.Response> {
    return this._client.call(
      'com.atproto.server.checkAccountStatus',
      params,
      undefined,
      opts,
    )
  }

  confirmEmail(
    data?: ComAtprotoServerConfirmEmail.InputSchema,
    opts?: ComAtprotoServerConfirmEmail.CallOptions,
  ): Promise<ComAtprotoServerConfirmEmail.Response> {
    return this._client
      .call('com.atproto.server.confirmEmail', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerConfirmEmail.toKnownErr(e)
      })
  }

  createAccount(
    data?: ComAtprotoServerCreateAccount.InputSchema,
    opts?: ComAtprotoServerCreateAccount.CallOptions,
  ): Promise<ComAtprotoServerCreateAccount.Response> {
    return this._client
      .call('com.atproto.server.createAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateAccount.toKnownErr(e)
      })
  }

  createAppPassword(
    data?: ComAtprotoServerCreateAppPassword.InputSchema,
    opts?: ComAtprotoServerCreateAppPassword.CallOptions,
  ): Promise<ComAtprotoServerCreateAppPassword.Response> {
    return this._client
      .call('com.atproto.server.createAppPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateAppPassword.toKnownErr(e)
      })
  }

  createInviteCode(
    data?: ComAtprotoServerCreateInviteCode.InputSchema,
    opts?: ComAtprotoServerCreateInviteCode.CallOptions,
  ): Promise<ComAtprotoServerCreateInviteCode.Response> {
    return this._client.call(
      'com.atproto.server.createInviteCode',
      opts?.qp,
      data,
      opts,
    )
  }

  createInviteCodes(
    data?: ComAtprotoServerCreateInviteCodes.InputSchema,
    opts?: ComAtprotoServerCreateInviteCodes.CallOptions,
  ): Promise<ComAtprotoServerCreateInviteCodes.Response> {
    return this._client.call(
      'com.atproto.server.createInviteCodes',
      opts?.qp,
      data,
      opts,
    )
  }

  createSession(
    data?: ComAtprotoServerCreateSession.InputSchema,
    opts?: ComAtprotoServerCreateSession.CallOptions,
  ): Promise<ComAtprotoServerCreateSession.Response> {
    return this._client
      .call('com.atproto.server.createSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateSession.toKnownErr(e)
      })
  }

  deactivateAccount(
    data?: ComAtprotoServerDeactivateAccount.InputSchema,
    opts?: ComAtprotoServerDeactivateAccount.CallOptions,
  ): Promise<ComAtprotoServerDeactivateAccount.Response> {
    return this._client.call(
      'com.atproto.server.deactivateAccount',
      opts?.qp,
      data,
      opts,
    )
  }

  deleteAccount(
    data?: ComAtprotoServerDeleteAccount.InputSchema,
    opts?: ComAtprotoServerDeleteAccount.CallOptions,
  ): Promise<ComAtprotoServerDeleteAccount.Response> {
    return this._client
      .call('com.atproto.server.deleteAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerDeleteAccount.toKnownErr(e)
      })
  }

  deleteSession(
    data?: ComAtprotoServerDeleteSession.InputSchema,
    opts?: ComAtprotoServerDeleteSession.CallOptions,
  ): Promise<ComAtprotoServerDeleteSession.Response> {
    return this._client.call(
      'com.atproto.server.deleteSession',
      opts?.qp,
      data,
      opts,
    )
  }

  describeServer(
    params?: ComAtprotoServerDescribeServer.QueryParams,
    opts?: ComAtprotoServerDescribeServer.CallOptions,
  ): Promise<ComAtprotoServerDescribeServer.Response> {
    return this._client.call(
      'com.atproto.server.describeServer',
      params,
      undefined,
      opts,
    )
  }

  getAccountInviteCodes(
    params?: ComAtprotoServerGetAccountInviteCodes.QueryParams,
    opts?: ComAtprotoServerGetAccountInviteCodes.CallOptions,
  ): Promise<ComAtprotoServerGetAccountInviteCodes.Response> {
    return this._client
      .call('com.atproto.server.getAccountInviteCodes', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerGetAccountInviteCodes.toKnownErr(e)
      })
  }

  getServiceAuth(
    params?: ComAtprotoServerGetServiceAuth.QueryParams,
    opts?: ComAtprotoServerGetServiceAuth.CallOptions,
  ): Promise<ComAtprotoServerGetServiceAuth.Response> {
    return this._client
      .call('com.atproto.server.getServiceAuth', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerGetServiceAuth.toKnownErr(e)
      })
  }

  getSession(
    params?: ComAtprotoServerGetSession.QueryParams,
    opts?: ComAtprotoServerGetSession.CallOptions,
  ): Promise<ComAtprotoServerGetSession.Response> {
    return this._client.call(
      'com.atproto.server.getSession',
      params,
      undefined,
      opts,
    )
  }

  listAppPasswords(
    params?: ComAtprotoServerListAppPasswords.QueryParams,
    opts?: ComAtprotoServerListAppPasswords.CallOptions,
  ): Promise<ComAtprotoServerListAppPasswords.Response> {
    return this._client
      .call('com.atproto.server.listAppPasswords', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerListAppPasswords.toKnownErr(e)
      })
  }

  refreshSession(
    data?: ComAtprotoServerRefreshSession.InputSchema,
    opts?: ComAtprotoServerRefreshSession.CallOptions,
  ): Promise<ComAtprotoServerRefreshSession.Response> {
    return this._client
      .call('com.atproto.server.refreshSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerRefreshSession.toKnownErr(e)
      })
  }

  requestAccountDelete(
    data?: ComAtprotoServerRequestAccountDelete.InputSchema,
    opts?: ComAtprotoServerRequestAccountDelete.CallOptions,
  ): Promise<ComAtprotoServerRequestAccountDelete.Response> {
    return this._client.call(
      'com.atproto.server.requestAccountDelete',
      opts?.qp,
      data,
      opts,
    )
  }

  requestEmailConfirmation(
    data?: ComAtprotoServerRequestEmailConfirmation.InputSchema,
    opts?: ComAtprotoServerRequestEmailConfirmation.CallOptions,
  ): Promise<ComAtprotoServerRequestEmailConfirmation.Response> {
    return this._client.call(
      'com.atproto.server.requestEmailConfirmation',
      opts?.qp,
      data,
      opts,
    )
  }

  requestEmailUpdate(
    data?: ComAtprotoServerRequestEmailUpdate.InputSchema,
    opts?: ComAtprotoServerRequestEmailUpdate.CallOptions,
  ): Promise<ComAtprotoServerRequestEmailUpdate.Response> {
    return this._client.call(
      'com.atproto.server.requestEmailUpdate',
      opts?.qp,
      data,
      opts,
    )
  }

  requestPasswordReset(
    data?: ComAtprotoServerRequestPasswordReset.InputSchema,
    opts?: ComAtprotoServerRequestPasswordReset.CallOptions,
  ): Promise<ComAtprotoServerRequestPasswordReset.Response> {
    return this._client.call(
      'com.atproto.server.requestPasswordReset',
      opts?.qp,
      data,
      opts,
    )
  }

  reserveSigningKey(
    data?: ComAtprotoServerReserveSigningKey.InputSchema,
    opts?: ComAtprotoServerReserveSigningKey.CallOptions,
  ): Promise<ComAtprotoServerReserveSigningKey.Response> {
    return this._client.call(
      'com.atproto.server.reserveSigningKey',
      opts?.qp,
      data,
      opts,
    )
  }

  resetPassword(
    data?: ComAtprotoServerResetPassword.InputSchema,
    opts?: ComAtprotoServerResetPassword.CallOptions,
  ): Promise<ComAtprotoServerResetPassword.Response> {
    return this._client
      .call('com.atproto.server.resetPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerResetPassword.toKnownErr(e)
      })
  }

  revokeAppPassword(
    data?: ComAtprotoServerRevokeAppPassword.InputSchema,
    opts?: ComAtprotoServerRevokeAppPassword.CallOptions,
  ): Promise<ComAtprotoServerRevokeAppPassword.Response> {
    return this._client.call(
      'com.atproto.server.revokeAppPassword',
      opts?.qp,
      data,
      opts,
    )
  }

  updateEmail(
    data?: ComAtprotoServerUpdateEmail.InputSchema,
    opts?: ComAtprotoServerUpdateEmail.CallOptions,
  ): Promise<ComAtprotoServerUpdateEmail.Response> {
    return this._client
      .call('com.atproto.server.updateEmail', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerUpdateEmail.toKnownErr(e)
      })
  }
}

export class ComAtprotoSyncNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getBlob(
    params?: ComAtprotoSyncGetBlob.QueryParams,
    opts?: ComAtprotoSyncGetBlob.CallOptions,
  ): Promise<ComAtprotoSyncGetBlob.Response> {
    return this._client
      .call('com.atproto.sync.getBlob', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetBlob.toKnownErr(e)
      })
  }

  getBlocks(
    params?: ComAtprotoSyncGetBlocks.QueryParams,
    opts?: ComAtprotoSyncGetBlocks.CallOptions,
  ): Promise<ComAtprotoSyncGetBlocks.Response> {
    return this._client
      .call('com.atproto.sync.getBlocks', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetBlocks.toKnownErr(e)
      })
  }

  getCheckout(
    params?: ComAtprotoSyncGetCheckout.QueryParams,
    opts?: ComAtprotoSyncGetCheckout.CallOptions,
  ): Promise<ComAtprotoSyncGetCheckout.Response> {
    return this._client.call(
      'com.atproto.sync.getCheckout',
      params,
      undefined,
      opts,
    )
  }

  getHead(
    params?: ComAtprotoSyncGetHead.QueryParams,
    opts?: ComAtprotoSyncGetHead.CallOptions,
  ): Promise<ComAtprotoSyncGetHead.Response> {
    return this._client
      .call('com.atproto.sync.getHead', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetHead.toKnownErr(e)
      })
  }

  getHostStatus(
    params?: ComAtprotoSyncGetHostStatus.QueryParams,
    opts?: ComAtprotoSyncGetHostStatus.CallOptions,
  ): Promise<ComAtprotoSyncGetHostStatus.Response> {
    return this._client
      .call('com.atproto.sync.getHostStatus', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetHostStatus.toKnownErr(e)
      })
  }

  getLatestCommit(
    params?: ComAtprotoSyncGetLatestCommit.QueryParams,
    opts?: ComAtprotoSyncGetLatestCommit.CallOptions,
  ): Promise<ComAtprotoSyncGetLatestCommit.Response> {
    return this._client
      .call('com.atproto.sync.getLatestCommit', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetLatestCommit.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoSyncGetRecord.QueryParams,
    opts?: ComAtprotoSyncGetRecord.CallOptions,
  ): Promise<ComAtprotoSyncGetRecord.Response> {
    return this._client
      .call('com.atproto.sync.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRecord.toKnownErr(e)
      })
  }

  getRepo(
    params?: ComAtprotoSyncGetRepo.QueryParams,
    opts?: ComAtprotoSyncGetRepo.CallOptions,
  ): Promise<ComAtprotoSyncGetRepo.Response> {
    return this._client
      .call('com.atproto.sync.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRepo.toKnownErr(e)
      })
  }

  getRepoStatus(
    params?: ComAtprotoSyncGetRepoStatus.QueryParams,
    opts?: ComAtprotoSyncGetRepoStatus.CallOptions,
  ): Promise<ComAtprotoSyncGetRepoStatus.Response> {
    return this._client
      .call('com.atproto.sync.getRepoStatus', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRepoStatus.toKnownErr(e)
      })
  }

  listBlobs(
    params?: ComAtprotoSyncListBlobs.QueryParams,
    opts?: ComAtprotoSyncListBlobs.CallOptions,
  ): Promise<ComAtprotoSyncListBlobs.Response> {
    return this._client
      .call('com.atproto.sync.listBlobs', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncListBlobs.toKnownErr(e)
      })
  }

  listHosts(
    params?: ComAtprotoSyncListHosts.QueryParams,
    opts?: ComAtprotoSyncListHosts.CallOptions,
  ): Promise<ComAtprotoSyncListHosts.Response> {
    return this._client.call(
      'com.atproto.sync.listHosts',
      params,
      undefined,
      opts,
    )
  }

  listRepos(
    params?: ComAtprotoSyncListRepos.QueryParams,
    opts?: ComAtprotoSyncListRepos.CallOptions,
  ): Promise<ComAtprotoSyncListRepos.Response> {
    return this._client.call(
      'com.atproto.sync.listRepos',
      params,
      undefined,
      opts,
    )
  }

  listReposByCollection(
    params?: ComAtprotoSyncListReposByCollection.QueryParams,
    opts?: ComAtprotoSyncListReposByCollection.CallOptions,
  ): Promise<ComAtprotoSyncListReposByCollection.Response> {
    return this._client.call(
      'com.atproto.sync.listReposByCollection',
      params,
      undefined,
      opts,
    )
  }

  notifyOfUpdate(
    data?: ComAtprotoSyncNotifyOfUpdate.InputSchema,
    opts?: ComAtprotoSyncNotifyOfUpdate.CallOptions,
  ): Promise<ComAtprotoSyncNotifyOfUpdate.Response> {
    return this._client.call(
      'com.atproto.sync.notifyOfUpdate',
      opts?.qp,
      data,
      opts,
    )
  }

  requestCrawl(
    data?: ComAtprotoSyncRequestCrawl.InputSchema,
    opts?: ComAtprotoSyncRequestCrawl.CallOptions,
  ): Promise<ComAtprotoSyncRequestCrawl.Response> {
    return this._client
      .call('com.atproto.sync.requestCrawl', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSyncRequestCrawl.toKnownErr(e)
      })
  }
}

export class ComAtprotoTempNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  addReservedHandle(
    data?: ComAtprotoTempAddReservedHandle.InputSchema,
    opts?: ComAtprotoTempAddReservedHandle.CallOptions,
  ): Promise<ComAtprotoTempAddReservedHandle.Response> {
    return this._client.call(
      'com.atproto.temp.addReservedHandle',
      opts?.qp,
      data,
      opts,
    )
  }

  checkHandleAvailability(
    params?: ComAtprotoTempCheckHandleAvailability.QueryParams,
    opts?: ComAtprotoTempCheckHandleAvailability.CallOptions,
  ): Promise<ComAtprotoTempCheckHandleAvailability.Response> {
    return this._client
      .call('com.atproto.temp.checkHandleAvailability', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoTempCheckHandleAvailability.toKnownErr(e)
      })
  }

  checkSignupQueue(
    params?: ComAtprotoTempCheckSignupQueue.QueryParams,
    opts?: ComAtprotoTempCheckSignupQueue.CallOptions,
  ): Promise<ComAtprotoTempCheckSignupQueue.Response> {
    return this._client.call(
      'com.atproto.temp.checkSignupQueue',
      params,
      undefined,
      opts,
    )
  }

  fetchLabels(
    params?: ComAtprotoTempFetchLabels.QueryParams,
    opts?: ComAtprotoTempFetchLabels.CallOptions,
  ): Promise<ComAtprotoTempFetchLabels.Response> {
    return this._client.call(
      'com.atproto.temp.fetchLabels',
      params,
      undefined,
      opts,
    )
  }

  requestPhoneVerification(
    data?: ComAtprotoTempRequestPhoneVerification.InputSchema,
    opts?: ComAtprotoTempRequestPhoneVerification.CallOptions,
  ): Promise<ComAtprotoTempRequestPhoneVerification.Response> {
    return this._client.call(
      'com.atproto.temp.requestPhoneVerification',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class AppNS {
  _client: XrpcClient
  bsky: AppBskyNS

  constructor(client: XrpcClient) {
    this._client = client
    this.bsky = new AppBskyNS(client)
  }
}

export class AppBskyNS {
  _client: XrpcClient
  actor: AppBskyActorNS
  embed: AppBskyEmbedNS
  feed: AppBskyFeedNS
  graph: AppBskyGraphNS
  labeler: AppBskyLabelerNS
  notification: AppBskyNotificationNS
  richtext: AppBskyRichtextNS
  unspecced: AppBskyUnspeccedNS
  video: AppBskyVideoNS

  constructor(client: XrpcClient) {
    this._client = client
    this.actor = new AppBskyActorNS(client)
    this.embed = new AppBskyEmbedNS(client)
    this.feed = new AppBskyFeedNS(client)
    this.graph = new AppBskyGraphNS(client)
    this.labeler = new AppBskyLabelerNS(client)
    this.notification = new AppBskyNotificationNS(client)
    this.richtext = new AppBskyRichtextNS(client)
    this.unspecced = new AppBskyUnspeccedNS(client)
    this.video = new AppBskyVideoNS(client)
  }
}

export class AppBskyActorNS {
  _client: XrpcClient
  profile: AppBskyActorProfileRecord
  status: AppBskyActorStatusRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.profile = new AppBskyActorProfileRecord(client)
    this.status = new AppBskyActorStatusRecord(client)
  }

  getPreferences(
    params?: AppBskyActorGetPreferences.QueryParams,
    opts?: AppBskyActorGetPreferences.CallOptions,
  ): Promise<AppBskyActorGetPreferences.Response> {
    return this._client.call(
      'app.bsky.actor.getPreferences',
      params,
      undefined,
      opts,
    )
  }

  getProfile(
    params?: AppBskyActorGetProfile.QueryParams,
    opts?: AppBskyActorGetProfile.CallOptions,
  ): Promise<AppBskyActorGetProfile.Response> {
    return this._client.call(
      'app.bsky.actor.getProfile',
      params,
      undefined,
      opts,
    )
  }

  getProfiles(
    params?: AppBskyActorGetProfiles.QueryParams,
    opts?: AppBskyActorGetProfiles.CallOptions,
  ): Promise<AppBskyActorGetProfiles.Response> {
    return this._client.call(
      'app.bsky.actor.getProfiles',
      params,
      undefined,
      opts,
    )
  }

  getSuggestions(
    params?: AppBskyActorGetSuggestions.QueryParams,
    opts?: AppBskyActorGetSuggestions.CallOptions,
  ): Promise<AppBskyActorGetSuggestions.Response> {
    return this._client.call(
      'app.bsky.actor.getSuggestions',
      params,
      undefined,
      opts,
    )
  }

  putPreferences(
    data?: AppBskyActorPutPreferences.InputSchema,
    opts?: AppBskyActorPutPreferences.CallOptions,
  ): Promise<AppBskyActorPutPreferences.Response> {
    return this._client.call(
      'app.bsky.actor.putPreferences',
      opts?.qp,
      data,
      opts,
    )
  }

  searchActors(
    params?: AppBskyActorSearchActors.QueryParams,
    opts?: AppBskyActorSearchActors.CallOptions,
  ): Promise<AppBskyActorSearchActors.Response> {
    return this._client.call(
      'app.bsky.actor.searchActors',
      params,
      undefined,
      opts,
    )
  }

  searchActorsTypeahead(
    params?: AppBskyActorSearchActorsTypeahead.QueryParams,
    opts?: AppBskyActorSearchActorsTypeahead.CallOptions,
  ): Promise<AppBskyActorSearchActorsTypeahead.Response> {
    return this._client.call(
      'app.bsky.actor.searchActorsTypeahead',
      params,
      undefined,
      opts,
    )
  }
}

export class AppBskyActorProfileRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyActorProfile.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.actor.profile',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyActorProfile.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.actor.profile',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyActorProfile.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.actor.profile'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyActorProfile.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.actor.profile'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.actor.profile', ...params },
      { headers },
    )
  }
}

export class AppBskyActorStatusRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyActorStatus.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.actor.status',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyActorStatus.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.actor.status',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyActorStatus.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.actor.status'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyActorStatus.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.actor.status'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.actor.status', ...params },
      { headers },
    )
  }
}

export class AppBskyEmbedNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }
}

export class AppBskyFeedNS {
  _client: XrpcClient
  generator: AppBskyFeedGeneratorRecord
  like: AppBskyFeedLikeRecord
  post: AppBskyFeedPostRecord
  postgate: AppBskyFeedPostgateRecord
  repost: AppBskyFeedRepostRecord
  threadgate: AppBskyFeedThreadgateRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.generator = new AppBskyFeedGeneratorRecord(client)
    this.like = new AppBskyFeedLikeRecord(client)
    this.post = new AppBskyFeedPostRecord(client)
    this.postgate = new AppBskyFeedPostgateRecord(client)
    this.repost = new AppBskyFeedRepostRecord(client)
    this.threadgate = new AppBskyFeedThreadgateRecord(client)
  }

  describeFeedGenerator(
    params?: AppBskyFeedDescribeFeedGenerator.QueryParams,
    opts?: AppBskyFeedDescribeFeedGenerator.CallOptions,
  ): Promise<AppBskyFeedDescribeFeedGenerator.Response> {
    return this._client.call(
      'app.bsky.feed.describeFeedGenerator',
      params,
      undefined,
      opts,
    )
  }

  getActorFeeds(
    params?: AppBskyFeedGetActorFeeds.QueryParams,
    opts?: AppBskyFeedGetActorFeeds.CallOptions,
  ): Promise<AppBskyFeedGetActorFeeds.Response> {
    return this._client.call(
      'app.bsky.feed.getActorFeeds',
      params,
      undefined,
      opts,
    )
  }

  getActorLikes(
    params?: AppBskyFeedGetActorLikes.QueryParams,
    opts?: AppBskyFeedGetActorLikes.CallOptions,
  ): Promise<AppBskyFeedGetActorLikes.Response> {
    return this._client
      .call('app.bsky.feed.getActorLikes', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetActorLikes.toKnownErr(e)
      })
  }

  getAuthorFeed(
    params?: AppBskyFeedGetAuthorFeed.QueryParams,
    opts?: AppBskyFeedGetAuthorFeed.CallOptions,
  ): Promise<AppBskyFeedGetAuthorFeed.Response> {
    return this._client
      .call('app.bsky.feed.getAuthorFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetAuthorFeed.toKnownErr(e)
      })
  }

  getFeed(
    params?: AppBskyFeedGetFeed.QueryParams,
    opts?: AppBskyFeedGetFeed.CallOptions,
  ): Promise<AppBskyFeedGetFeed.Response> {
    return this._client
      .call('app.bsky.feed.getFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetFeed.toKnownErr(e)
      })
  }

  getFeedGenerator(
    params?: AppBskyFeedGetFeedGenerator.QueryParams,
    opts?: AppBskyFeedGetFeedGenerator.CallOptions,
  ): Promise<AppBskyFeedGetFeedGenerator.Response> {
    return this._client.call(
      'app.bsky.feed.getFeedGenerator',
      params,
      undefined,
      opts,
    )
  }

  getFeedGenerators(
    params?: AppBskyFeedGetFeedGenerators.QueryParams,
    opts?: AppBskyFeedGetFeedGenerators.CallOptions,
  ): Promise<AppBskyFeedGetFeedGenerators.Response> {
    return this._client.call(
      'app.bsky.feed.getFeedGenerators',
      params,
      undefined,
      opts,
    )
  }

  getFeedSkeleton(
    params?: AppBskyFeedGetFeedSkeleton.QueryParams,
    opts?: AppBskyFeedGetFeedSkeleton.CallOptions,
  ): Promise<AppBskyFeedGetFeedSkeleton.Response> {
    return this._client
      .call('app.bsky.feed.getFeedSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetFeedSkeleton.toKnownErr(e)
      })
  }

  getLikes(
    params?: AppBskyFeedGetLikes.QueryParams,
    opts?: AppBskyFeedGetLikes.CallOptions,
  ): Promise<AppBskyFeedGetLikes.Response> {
    return this._client.call('app.bsky.feed.getLikes', params, undefined, opts)
  }

  getListFeed(
    params?: AppBskyFeedGetListFeed.QueryParams,
    opts?: AppBskyFeedGetListFeed.CallOptions,
  ): Promise<AppBskyFeedGetListFeed.Response> {
    return this._client
      .call('app.bsky.feed.getListFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetListFeed.toKnownErr(e)
      })
  }

  getPostThread(
    params?: AppBskyFeedGetPostThread.QueryParams,
    opts?: AppBskyFeedGetPostThread.CallOptions,
  ): Promise<AppBskyFeedGetPostThread.Response> {
    return this._client
      .call('app.bsky.feed.getPostThread', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetPostThread.toKnownErr(e)
      })
  }

  getPosts(
    params?: AppBskyFeedGetPosts.QueryParams,
    opts?: AppBskyFeedGetPosts.CallOptions,
  ): Promise<AppBskyFeedGetPosts.Response> {
    return this._client.call('app.bsky.feed.getPosts', params, undefined, opts)
  }

  getQuotes(
    params?: AppBskyFeedGetQuotes.QueryParams,
    opts?: AppBskyFeedGetQuotes.CallOptions,
  ): Promise<AppBskyFeedGetQuotes.Response> {
    return this._client.call('app.bsky.feed.getQuotes', params, undefined, opts)
  }

  getRepostedBy(
    params?: AppBskyFeedGetRepostedBy.QueryParams,
    opts?: AppBskyFeedGetRepostedBy.CallOptions,
  ): Promise<AppBskyFeedGetRepostedBy.Response> {
    return this._client.call(
      'app.bsky.feed.getRepostedBy',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedFeeds(
    params?: AppBskyFeedGetSuggestedFeeds.QueryParams,
    opts?: AppBskyFeedGetSuggestedFeeds.CallOptions,
  ): Promise<AppBskyFeedGetSuggestedFeeds.Response> {
    return this._client.call(
      'app.bsky.feed.getSuggestedFeeds',
      params,
      undefined,
      opts,
    )
  }

  getTimeline(
    params?: AppBskyFeedGetTimeline.QueryParams,
    opts?: AppBskyFeedGetTimeline.CallOptions,
  ): Promise<AppBskyFeedGetTimeline.Response> {
    return this._client.call(
      'app.bsky.feed.getTimeline',
      params,
      undefined,
      opts,
    )
  }

  searchPosts(
    params?: AppBskyFeedSearchPosts.QueryParams,
    opts?: AppBskyFeedSearchPosts.CallOptions,
  ): Promise<AppBskyFeedSearchPosts.Response> {
    return this._client
      .call('app.bsky.feed.searchPosts', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedSearchPosts.toKnownErr(e)
      })
  }

  sendInteractions(
    data?: AppBskyFeedSendInteractions.InputSchema,
    opts?: AppBskyFeedSendInteractions.CallOptions,
  ): Promise<AppBskyFeedSendInteractions.Response> {
    return this._client.call(
      'app.bsky.feed.sendInteractions',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class AppBskyFeedGeneratorRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedGenerator.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.generator',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedGenerator.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.generator',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedGenerator.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.generator'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedGenerator.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.generator'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.generator', ...params },
      { headers },
    )
  }
}

export class AppBskyFeedLikeRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedLike.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.like',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedLike.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.like',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedLike.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.like'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedLike.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.like'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.like', ...params },
      { headers },
    )
  }
}

export class AppBskyFeedPostRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedPost.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.post',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedPost.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.post',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedPost.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.post'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedPost.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.post'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.post', ...params },
      { headers },
    )
  }
}

export class AppBskyFeedPostgateRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedPostgate.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.postgate',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedPostgate.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.postgate',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedPostgate.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.postgate'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedPostgate.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.postgate'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.postgate', ...params },
      { headers },
    )
  }
}

export class AppBskyFeedRepostRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedRepost.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.repost',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedRepost.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.repost',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedRepost.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.repost'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedRepost.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.repost'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.repost', ...params },
      { headers },
    )
  }
}

export class AppBskyFeedThreadgateRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedThreadgate.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.threadgate',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyFeedThreadgate.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.threadgate',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedThreadgate.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.threadgate'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyFeedThreadgate.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.feed.threadgate'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.threadgate', ...params },
      { headers },
    )
  }
}

export class AppBskyGraphNS {
  _client: XrpcClient
  block: AppBskyGraphBlockRecord
  follow: AppBskyGraphFollowRecord
  list: AppBskyGraphListRecord
  listblock: AppBskyGraphListblockRecord
  listitem: AppBskyGraphListitemRecord
  starterpack: AppBskyGraphStarterpackRecord
  verification: AppBskyGraphVerificationRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.block = new AppBskyGraphBlockRecord(client)
    this.follow = new AppBskyGraphFollowRecord(client)
    this.list = new AppBskyGraphListRecord(client)
    this.listblock = new AppBskyGraphListblockRecord(client)
    this.listitem = new AppBskyGraphListitemRecord(client)
    this.starterpack = new AppBskyGraphStarterpackRecord(client)
    this.verification = new AppBskyGraphVerificationRecord(client)
  }

  getActorStarterPacks(
    params?: AppBskyGraphGetActorStarterPacks.QueryParams,
    opts?: AppBskyGraphGetActorStarterPacks.CallOptions,
  ): Promise<AppBskyGraphGetActorStarterPacks.Response> {
    return this._client.call(
      'app.bsky.graph.getActorStarterPacks',
      params,
      undefined,
      opts,
    )
  }

  getBlocks(
    params?: AppBskyGraphGetBlocks.QueryParams,
    opts?: AppBskyGraphGetBlocks.CallOptions,
  ): Promise<AppBskyGraphGetBlocks.Response> {
    return this._client.call(
      'app.bsky.graph.getBlocks',
      params,
      undefined,
      opts,
    )
  }

  getFollowers(
    params?: AppBskyGraphGetFollowers.QueryParams,
    opts?: AppBskyGraphGetFollowers.CallOptions,
  ): Promise<AppBskyGraphGetFollowers.Response> {
    return this._client.call(
      'app.bsky.graph.getFollowers',
      params,
      undefined,
      opts,
    )
  }

  getFollows(
    params?: AppBskyGraphGetFollows.QueryParams,
    opts?: AppBskyGraphGetFollows.CallOptions,
  ): Promise<AppBskyGraphGetFollows.Response> {
    return this._client.call(
      'app.bsky.graph.getFollows',
      params,
      undefined,
      opts,
    )
  }

  getKnownFollowers(
    params?: AppBskyGraphGetKnownFollowers.QueryParams,
    opts?: AppBskyGraphGetKnownFollowers.CallOptions,
  ): Promise<AppBskyGraphGetKnownFollowers.Response> {
    return this._client.call(
      'app.bsky.graph.getKnownFollowers',
      params,
      undefined,
      opts,
    )
  }

  getList(
    params?: AppBskyGraphGetList.QueryParams,
    opts?: AppBskyGraphGetList.CallOptions,
  ): Promise<AppBskyGraphGetList.Response> {
    return this._client.call('app.bsky.graph.getList', params, undefined, opts)
  }

  getListBlocks(
    params?: AppBskyGraphGetListBlocks.QueryParams,
    opts?: AppBskyGraphGetListBlocks.CallOptions,
  ): Promise<AppBskyGraphGetListBlocks.Response> {
    return this._client.call(
      'app.bsky.graph.getListBlocks',
      params,
      undefined,
      opts,
    )
  }

  getListMutes(
    params?: AppBskyGraphGetListMutes.QueryParams,
    opts?: AppBskyGraphGetListMutes.CallOptions,
  ): Promise<AppBskyGraphGetListMutes.Response> {
    return this._client.call(
      'app.bsky.graph.getListMutes',
      params,
      undefined,
      opts,
    )
  }

  getLists(
    params?: AppBskyGraphGetLists.QueryParams,
    opts?: AppBskyGraphGetLists.CallOptions,
  ): Promise<AppBskyGraphGetLists.Response> {
    return this._client.call('app.bsky.graph.getLists', params, undefined, opts)
  }

  getListsWithMembership(
    params?: AppBskyGraphGetListsWithMembership.QueryParams,
    opts?: AppBskyGraphGetListsWithMembership.CallOptions,
  ): Promise<AppBskyGraphGetListsWithMembership.Response> {
    return this._client.call(
      'app.bsky.graph.getListsWithMembership',
      params,
      undefined,
      opts,
    )
  }

  getMutes(
    params?: AppBskyGraphGetMutes.QueryParams,
    opts?: AppBskyGraphGetMutes.CallOptions,
  ): Promise<AppBskyGraphGetMutes.Response> {
    return this._client.call('app.bsky.graph.getMutes', params, undefined, opts)
  }

  getRelationships(
    params?: AppBskyGraphGetRelationships.QueryParams,
    opts?: AppBskyGraphGetRelationships.CallOptions,
  ): Promise<AppBskyGraphGetRelationships.Response> {
    return this._client
      .call('app.bsky.graph.getRelationships', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetRelationships.toKnownErr(e)
      })
  }

  getStarterPack(
    params?: AppBskyGraphGetStarterPack.QueryParams,
    opts?: AppBskyGraphGetStarterPack.CallOptions,
  ): Promise<AppBskyGraphGetStarterPack.Response> {
    return this._client.call(
      'app.bsky.graph.getStarterPack',
      params,
      undefined,
      opts,
    )
  }

  getStarterPacks(
    params?: AppBskyGraphGetStarterPacks.QueryParams,
    opts?: AppBskyGraphGetStarterPacks.CallOptions,
  ): Promise<AppBskyGraphGetStarterPacks.Response> {
    return this._client.call(
      'app.bsky.graph.getStarterPacks',
      params,
      undefined,
      opts,
    )
  }

  getStarterPacksWithMembership(
    params?: AppBskyGraphGetStarterPacksWithMembership.QueryParams,
    opts?: AppBskyGraphGetStarterPacksWithMembership.CallOptions,
  ): Promise<AppBskyGraphGetStarterPacksWithMembership.Response> {
    return this._client.call(
      'app.bsky.graph.getStarterPacksWithMembership',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedFollowsByActor(
    params?: AppBskyGraphGetSuggestedFollowsByActor.QueryParams,
    opts?: AppBskyGraphGetSuggestedFollowsByActor.CallOptions,
  ): Promise<AppBskyGraphGetSuggestedFollowsByActor.Response> {
    return this._client.call(
      'app.bsky.graph.getSuggestedFollowsByActor',
      params,
      undefined,
      opts,
    )
  }

  muteActor(
    data?: AppBskyGraphMuteActor.InputSchema,
    opts?: AppBskyGraphMuteActor.CallOptions,
  ): Promise<AppBskyGraphMuteActor.Response> {
    return this._client.call('app.bsky.graph.muteActor', opts?.qp, data, opts)
  }

  muteActorList(
    data?: AppBskyGraphMuteActorList.InputSchema,
    opts?: AppBskyGraphMuteActorList.CallOptions,
  ): Promise<AppBskyGraphMuteActorList.Response> {
    return this._client.call(
      'app.bsky.graph.muteActorList',
      opts?.qp,
      data,
      opts,
    )
  }

  muteThread(
    data?: AppBskyGraphMuteThread.InputSchema,
    opts?: AppBskyGraphMuteThread.CallOptions,
  ): Promise<AppBskyGraphMuteThread.Response> {
    return this._client.call('app.bsky.graph.muteThread', opts?.qp, data, opts)
  }

  searchStarterPacks(
    params?: AppBskyGraphSearchStarterPacks.QueryParams,
    opts?: AppBskyGraphSearchStarterPacks.CallOptions,
  ): Promise<AppBskyGraphSearchStarterPacks.Response> {
    return this._client.call(
      'app.bsky.graph.searchStarterPacks',
      params,
      undefined,
      opts,
    )
  }

  unmuteActor(
    data?: AppBskyGraphUnmuteActor.InputSchema,
    opts?: AppBskyGraphUnmuteActor.CallOptions,
  ): Promise<AppBskyGraphUnmuteActor.Response> {
    return this._client.call('app.bsky.graph.unmuteActor', opts?.qp, data, opts)
  }

  unmuteActorList(
    data?: AppBskyGraphUnmuteActorList.InputSchema,
    opts?: AppBskyGraphUnmuteActorList.CallOptions,
  ): Promise<AppBskyGraphUnmuteActorList.Response> {
    return this._client.call(
      'app.bsky.graph.unmuteActorList',
      opts?.qp,
      data,
      opts,
    )
  }

  unmuteThread(
    data?: AppBskyGraphUnmuteThread.InputSchema,
    opts?: AppBskyGraphUnmuteThread.CallOptions,
  ): Promise<AppBskyGraphUnmuteThread.Response> {
    return this._client.call(
      'app.bsky.graph.unmuteThread',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class AppBskyGraphBlockRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphBlock.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.block',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphBlock.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.block',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphBlock.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.block'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphBlock.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.block'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.block', ...params },
      { headers },
    )
  }
}

export class AppBskyGraphFollowRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphFollow.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.follow',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphFollow.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.follow',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphFollow.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.follow'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphFollow.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.follow'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.follow', ...params },
      { headers },
    )
  }
}

export class AppBskyGraphListRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphList.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.list',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphList.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.list',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphList.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.list'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphList.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.list'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.list', ...params },
      { headers },
    )
  }
}

export class AppBskyGraphListblockRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphListblock.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.listblock',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyGraphListblock.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.listblock',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphListblock.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.listblock'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphListblock.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.listblock'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.listblock', ...params },
      { headers },
    )
  }
}

export class AppBskyGraphListitemRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphListitem.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.listitem',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphListitem.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.listitem',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphListitem.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.listitem'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphListitem.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.listitem'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.listitem', ...params },
      { headers },
    )
  }
}

export class AppBskyGraphStarterpackRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphStarterpack.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.starterpack',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyGraphStarterpack.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.starterpack',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphStarterpack.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.starterpack'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphStarterpack.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.starterpack'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.starterpack', ...params },
      { headers },
    )
  }
}

export class AppBskyGraphVerificationRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphVerification.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.verification',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyGraphVerification.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.verification',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphVerification.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.verification'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyGraphVerification.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.graph.verification'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.verification', ...params },
      { headers },
    )
  }
}

export class AppBskyLabelerNS {
  _client: XrpcClient
  service: AppBskyLabelerServiceRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.service = new AppBskyLabelerServiceRecord(client)
  }

  getServices(
    params?: AppBskyLabelerGetServices.QueryParams,
    opts?: AppBskyLabelerGetServices.CallOptions,
  ): Promise<AppBskyLabelerGetServices.Response> {
    return this._client.call(
      'app.bsky.labeler.getServices',
      params,
      undefined,
      opts,
    )
  }
}

export class AppBskyLabelerServiceRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyLabelerService.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.labeler.service',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyLabelerService.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.labeler.service',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyLabelerService.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.labeler.service'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyLabelerService.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.labeler.service'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.labeler.service', ...params },
      { headers },
    )
  }
}

export class AppBskyNotificationNS {
  _client: XrpcClient
  declaration: AppBskyNotificationDeclarationRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.declaration = new AppBskyNotificationDeclarationRecord(client)
  }

  getPreferences(
    params?: AppBskyNotificationGetPreferences.QueryParams,
    opts?: AppBskyNotificationGetPreferences.CallOptions,
  ): Promise<AppBskyNotificationGetPreferences.Response> {
    return this._client.call(
      'app.bsky.notification.getPreferences',
      params,
      undefined,
      opts,
    )
  }

  getUnreadCount(
    params?: AppBskyNotificationGetUnreadCount.QueryParams,
    opts?: AppBskyNotificationGetUnreadCount.CallOptions,
  ): Promise<AppBskyNotificationGetUnreadCount.Response> {
    return this._client.call(
      'app.bsky.notification.getUnreadCount',
      params,
      undefined,
      opts,
    )
  }

  listActivitySubscriptions(
    params?: AppBskyNotificationListActivitySubscriptions.QueryParams,
    opts?: AppBskyNotificationListActivitySubscriptions.CallOptions,
  ): Promise<AppBskyNotificationListActivitySubscriptions.Response> {
    return this._client.call(
      'app.bsky.notification.listActivitySubscriptions',
      params,
      undefined,
      opts,
    )
  }

  listNotifications(
    params?: AppBskyNotificationListNotifications.QueryParams,
    opts?: AppBskyNotificationListNotifications.CallOptions,
  ): Promise<AppBskyNotificationListNotifications.Response> {
    return this._client.call(
      'app.bsky.notification.listNotifications',
      params,
      undefined,
      opts,
    )
  }

  putActivitySubscription(
    data?: AppBskyNotificationPutActivitySubscription.InputSchema,
    opts?: AppBskyNotificationPutActivitySubscription.CallOptions,
  ): Promise<AppBskyNotificationPutActivitySubscription.Response> {
    return this._client.call(
      'app.bsky.notification.putActivitySubscription',
      opts?.qp,
      data,
      opts,
    )
  }

  putPreferences(
    data?: AppBskyNotificationPutPreferences.InputSchema,
    opts?: AppBskyNotificationPutPreferences.CallOptions,
  ): Promise<AppBskyNotificationPutPreferences.Response> {
    return this._client.call(
      'app.bsky.notification.putPreferences',
      opts?.qp,
      data,
      opts,
    )
  }

  putPreferencesV2(
    data?: AppBskyNotificationPutPreferencesV2.InputSchema,
    opts?: AppBskyNotificationPutPreferencesV2.CallOptions,
  ): Promise<AppBskyNotificationPutPreferencesV2.Response> {
    return this._client.call(
      'app.bsky.notification.putPreferencesV2',
      opts?.qp,
      data,
      opts,
    )
  }

  registerPush(
    data?: AppBskyNotificationRegisterPush.InputSchema,
    opts?: AppBskyNotificationRegisterPush.CallOptions,
  ): Promise<AppBskyNotificationRegisterPush.Response> {
    return this._client.call(
      'app.bsky.notification.registerPush',
      opts?.qp,
      data,
      opts,
    )
  }

  unregisterPush(
    data?: AppBskyNotificationUnregisterPush.InputSchema,
    opts?: AppBskyNotificationUnregisterPush.CallOptions,
  ): Promise<AppBskyNotificationUnregisterPush.Response> {
    return this._client.call(
      'app.bsky.notification.unregisterPush',
      opts?.qp,
      data,
      opts,
    )
  }

  updateSeen(
    data?: AppBskyNotificationUpdateSeen.InputSchema,
    opts?: AppBskyNotificationUpdateSeen.CallOptions,
  ): Promise<AppBskyNotificationUpdateSeen.Response> {
    return this._client.call(
      'app.bsky.notification.updateSeen',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class AppBskyNotificationDeclarationRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyNotificationDeclaration.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.notification.declaration',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyNotificationDeclaration.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.notification.declaration',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyNotificationDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.notification.declaration'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyNotificationDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.notification.declaration'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.notification.declaration', ...params },
      { headers },
    )
  }
}

export class AppBskyRichtextNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }
}

export class AppBskyUnspeccedNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getAgeAssuranceState(
    params?: AppBskyUnspeccedGetAgeAssuranceState.QueryParams,
    opts?: AppBskyUnspeccedGetAgeAssuranceState.CallOptions,
  ): Promise<AppBskyUnspeccedGetAgeAssuranceState.Response> {
    return this._client.call(
      'app.bsky.unspecced.getAgeAssuranceState',
      params,
      undefined,
      opts,
    )
  }

  getConfig(
    params?: AppBskyUnspeccedGetConfig.QueryParams,
    opts?: AppBskyUnspeccedGetConfig.CallOptions,
  ): Promise<AppBskyUnspeccedGetConfig.Response> {
    return this._client.call(
      'app.bsky.unspecced.getConfig',
      params,
      undefined,
      opts,
    )
  }

  getPopularFeedGenerators(
    params?: AppBskyUnspeccedGetPopularFeedGenerators.QueryParams,
    opts?: AppBskyUnspeccedGetPopularFeedGenerators.CallOptions,
  ): Promise<AppBskyUnspeccedGetPopularFeedGenerators.Response> {
    return this._client.call(
      'app.bsky.unspecced.getPopularFeedGenerators',
      params,
      undefined,
      opts,
    )
  }

  getPostThreadOtherV2(
    params?: AppBskyUnspeccedGetPostThreadOtherV2.QueryParams,
    opts?: AppBskyUnspeccedGetPostThreadOtherV2.CallOptions,
  ): Promise<AppBskyUnspeccedGetPostThreadOtherV2.Response> {
    return this._client.call(
      'app.bsky.unspecced.getPostThreadOtherV2',
      params,
      undefined,
      opts,
    )
  }

  getPostThreadV2(
    params?: AppBskyUnspeccedGetPostThreadV2.QueryParams,
    opts?: AppBskyUnspeccedGetPostThreadV2.CallOptions,
  ): Promise<AppBskyUnspeccedGetPostThreadV2.Response> {
    return this._client.call(
      'app.bsky.unspecced.getPostThreadV2',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedFeeds(
    params?: AppBskyUnspeccedGetSuggestedFeeds.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedFeeds.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedFeeds.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedFeeds',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedFeedsSkeleton(
    params?: AppBskyUnspeccedGetSuggestedFeedsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedFeedsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedFeedsSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedFeedsSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedStarterPacks(
    params?: AppBskyUnspeccedGetSuggestedStarterPacks.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedStarterPacks.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedStarterPacks.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedStarterPacks',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedStarterPacksSkeleton(
    params?: AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedStarterPacksSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedUsers(
    params?: AppBskyUnspeccedGetSuggestedUsers.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedUsers.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedUsers.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedUsers',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedUsersSkeleton(
    params?: AppBskyUnspeccedGetSuggestedUsersSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedUsersSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedUsersSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedUsersSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getSuggestionsSkeleton(
    params?: AppBskyUnspeccedGetSuggestionsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestionsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestionsSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestionsSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getTaggedSuggestions(
    params?: AppBskyUnspeccedGetTaggedSuggestions.QueryParams,
    opts?: AppBskyUnspeccedGetTaggedSuggestions.CallOptions,
  ): Promise<AppBskyUnspeccedGetTaggedSuggestions.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTaggedSuggestions',
      params,
      undefined,
      opts,
    )
  }

  getTrendingTopics(
    params?: AppBskyUnspeccedGetTrendingTopics.QueryParams,
    opts?: AppBskyUnspeccedGetTrendingTopics.CallOptions,
  ): Promise<AppBskyUnspeccedGetTrendingTopics.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTrendingTopics',
      params,
      undefined,
      opts,
    )
  }

  getTrends(
    params?: AppBskyUnspeccedGetTrends.QueryParams,
    opts?: AppBskyUnspeccedGetTrends.CallOptions,
  ): Promise<AppBskyUnspeccedGetTrends.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTrends',
      params,
      undefined,
      opts,
    )
  }

  getTrendsSkeleton(
    params?: AppBskyUnspeccedGetTrendsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetTrendsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetTrendsSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTrendsSkeleton',
      params,
      undefined,
      opts,
    )
  }

  initAgeAssurance(
    data?: AppBskyUnspeccedInitAgeAssurance.InputSchema,
    opts?: AppBskyUnspeccedInitAgeAssurance.CallOptions,
  ): Promise<AppBskyUnspeccedInitAgeAssurance.Response> {
    return this._client
      .call('app.bsky.unspecced.initAgeAssurance', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyUnspeccedInitAgeAssurance.toKnownErr(e)
      })
  }

  searchActorsSkeleton(
    params?: AppBskyUnspeccedSearchActorsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchActorsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchActorsSkeleton.Response> {
    return this._client
      .call('app.bsky.unspecced.searchActorsSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedSearchActorsSkeleton.toKnownErr(e)
      })
  }

  searchPostsSkeleton(
    params?: AppBskyUnspeccedSearchPostsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchPostsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchPostsSkeleton.Response> {
    return this._client
      .call('app.bsky.unspecced.searchPostsSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedSearchPostsSkeleton.toKnownErr(e)
      })
  }

  searchStarterPacksSkeleton(
    params?: AppBskyUnspeccedSearchStarterPacksSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchStarterPacksSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchStarterPacksSkeleton.Response> {
    return this._client
      .call(
        'app.bsky.unspecced.searchStarterPacksSkeleton',
        params,
        undefined,
        opts,
      )
      .catch((e) => {
        throw AppBskyUnspeccedSearchStarterPacksSkeleton.toKnownErr(e)
      })
  }
}

export class AppBskyVideoNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getJobStatus(
    params?: AppBskyVideoGetJobStatus.QueryParams,
    opts?: AppBskyVideoGetJobStatus.CallOptions,
  ): Promise<AppBskyVideoGetJobStatus.Response> {
    return this._client.call(
      'app.bsky.video.getJobStatus',
      params,
      undefined,
      opts,
    )
  }

  getUploadLimits(
    params?: AppBskyVideoGetUploadLimits.QueryParams,
    opts?: AppBskyVideoGetUploadLimits.CallOptions,
  ): Promise<AppBskyVideoGetUploadLimits.Response> {
    return this._client.call(
      'app.bsky.video.getUploadLimits',
      params,
      undefined,
      opts,
    )
  }

  uploadVideo(
    data?: AppBskyVideoUploadVideo.InputSchema,
    opts?: AppBskyVideoUploadVideo.CallOptions,
  ): Promise<AppBskyVideoUploadVideo.Response> {
    return this._client.call('app.bsky.video.uploadVideo', opts?.qp, data, opts)
  }
}

export class ChatNS {
  _client: XrpcClient
  bsky: ChatBskyNS

  constructor(client: XrpcClient) {
    this._client = client
    this.bsky = new ChatBskyNS(client)
  }
}

export class ChatBskyNS {
  _client: XrpcClient
  actor: ChatBskyActorNS
  convo: ChatBskyConvoNS
  moderation: ChatBskyModerationNS

  constructor(client: XrpcClient) {
    this._client = client
    this.actor = new ChatBskyActorNS(client)
    this.convo = new ChatBskyConvoNS(client)
    this.moderation = new ChatBskyModerationNS(client)
  }
}

export class ChatBskyActorNS {
  _client: XrpcClient
  declaration: ChatBskyActorDeclarationRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.declaration = new ChatBskyActorDeclarationRecord(client)
  }

  deleteAccount(
    data?: ChatBskyActorDeleteAccount.InputSchema,
    opts?: ChatBskyActorDeleteAccount.CallOptions,
  ): Promise<ChatBskyActorDeleteAccount.Response> {
    return this._client.call(
      'chat.bsky.actor.deleteAccount',
      opts?.qp,
      data,
      opts,
    )
  }

  exportAccountData(
    params?: ChatBskyActorExportAccountData.QueryParams,
    opts?: ChatBskyActorExportAccountData.CallOptions,
  ): Promise<ChatBskyActorExportAccountData.Response> {
    return this._client.call(
      'chat.bsky.actor.exportAccountData',
      params,
      undefined,
      opts,
    )
  }
}

export class ChatBskyActorDeclarationRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: ChatBskyActorDeclaration.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'chat.bsky.actor.declaration',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: ChatBskyActorDeclaration.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'chat.bsky.actor.declaration',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<ChatBskyActorDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'chat.bsky.actor.declaration'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<ChatBskyActorDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'chat.bsky.actor.declaration'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'chat.bsky.actor.declaration', ...params },
      { headers },
    )
  }
}

export class ChatBskyConvoNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  acceptConvo(
    data?: ChatBskyConvoAcceptConvo.InputSchema,
    opts?: ChatBskyConvoAcceptConvo.CallOptions,
  ): Promise<ChatBskyConvoAcceptConvo.Response> {
    return this._client.call(
      'chat.bsky.convo.acceptConvo',
      opts?.qp,
      data,
      opts,
    )
  }

  addReaction(
    data?: ChatBskyConvoAddReaction.InputSchema,
    opts?: ChatBskyConvoAddReaction.CallOptions,
  ): Promise<ChatBskyConvoAddReaction.Response> {
    return this._client
      .call('chat.bsky.convo.addReaction', opts?.qp, data, opts)
      .catch((e) => {
        throw ChatBskyConvoAddReaction.toKnownErr(e)
      })
  }

  deleteMessageForSelf(
    data?: ChatBskyConvoDeleteMessageForSelf.InputSchema,
    opts?: ChatBskyConvoDeleteMessageForSelf.CallOptions,
  ): Promise<ChatBskyConvoDeleteMessageForSelf.Response> {
    return this._client.call(
      'chat.bsky.convo.deleteMessageForSelf',
      opts?.qp,
      data,
      opts,
    )
  }

  getConvo(
    params?: ChatBskyConvoGetConvo.QueryParams,
    opts?: ChatBskyConvoGetConvo.CallOptions,
  ): Promise<ChatBskyConvoGetConvo.Response> {
    return this._client.call(
      'chat.bsky.convo.getConvo',
      params,
      undefined,
      opts,
    )
  }

  getConvoAvailability(
    params?: ChatBskyConvoGetConvoAvailability.QueryParams,
    opts?: ChatBskyConvoGetConvoAvailability.CallOptions,
  ): Promise<ChatBskyConvoGetConvoAvailability.Response> {
    return this._client.call(
      'chat.bsky.convo.getConvoAvailability',
      params,
      undefined,
      opts,
    )
  }

  getConvoForMembers(
    params?: ChatBskyConvoGetConvoForMembers.QueryParams,
    opts?: ChatBskyConvoGetConvoForMembers.CallOptions,
  ): Promise<ChatBskyConvoGetConvoForMembers.Response> {
    return this._client.call(
      'chat.bsky.convo.getConvoForMembers',
      params,
      undefined,
      opts,
    )
  }

  getLog(
    params?: ChatBskyConvoGetLog.QueryParams,
    opts?: ChatBskyConvoGetLog.CallOptions,
  ): Promise<ChatBskyConvoGetLog.Response> {
    return this._client.call('chat.bsky.convo.getLog', params, undefined, opts)
  }

  getMessages(
    params?: ChatBskyConvoGetMessages.QueryParams,
    opts?: ChatBskyConvoGetMessages.CallOptions,
  ): Promise<ChatBskyConvoGetMessages.Response> {
    return this._client.call(
      'chat.bsky.convo.getMessages',
      params,
      undefined,
      opts,
    )
  }

  leaveConvo(
    data?: ChatBskyConvoLeaveConvo.InputSchema,
    opts?: ChatBskyConvoLeaveConvo.CallOptions,
  ): Promise<ChatBskyConvoLeaveConvo.Response> {
    return this._client.call('chat.bsky.convo.leaveConvo', opts?.qp, data, opts)
  }

  listConvos(
    params?: ChatBskyConvoListConvos.QueryParams,
    opts?: ChatBskyConvoListConvos.CallOptions,
  ): Promise<ChatBskyConvoListConvos.Response> {
    return this._client.call(
      'chat.bsky.convo.listConvos',
      params,
      undefined,
      opts,
    )
  }

  muteConvo(
    data?: ChatBskyConvoMuteConvo.InputSchema,
    opts?: ChatBskyConvoMuteConvo.CallOptions,
  ): Promise<ChatBskyConvoMuteConvo.Response> {
    return this._client.call('chat.bsky.convo.muteConvo', opts?.qp, data, opts)
  }

  removeReaction(
    data?: ChatBskyConvoRemoveReaction.InputSchema,
    opts?: ChatBskyConvoRemoveReaction.CallOptions,
  ): Promise<ChatBskyConvoRemoveReaction.Response> {
    return this._client
      .call('chat.bsky.convo.removeReaction', opts?.qp, data, opts)
      .catch((e) => {
        throw ChatBskyConvoRemoveReaction.toKnownErr(e)
      })
  }

  sendMessage(
    data?: ChatBskyConvoSendMessage.InputSchema,
    opts?: ChatBskyConvoSendMessage.CallOptions,
  ): Promise<ChatBskyConvoSendMessage.Response> {
    return this._client.call(
      'chat.bsky.convo.sendMessage',
      opts?.qp,
      data,
      opts,
    )
  }

  sendMessageBatch(
    data?: ChatBskyConvoSendMessageBatch.InputSchema,
    opts?: ChatBskyConvoSendMessageBatch.CallOptions,
  ): Promise<ChatBskyConvoSendMessageBatch.Response> {
    return this._client.call(
      'chat.bsky.convo.sendMessageBatch',
      opts?.qp,
      data,
      opts,
    )
  }

  unmuteConvo(
    data?: ChatBskyConvoUnmuteConvo.InputSchema,
    opts?: ChatBskyConvoUnmuteConvo.CallOptions,
  ): Promise<ChatBskyConvoUnmuteConvo.Response> {
    return this._client.call(
      'chat.bsky.convo.unmuteConvo',
      opts?.qp,
      data,
      opts,
    )
  }

  updateAllRead(
    data?: ChatBskyConvoUpdateAllRead.InputSchema,
    opts?: ChatBskyConvoUpdateAllRead.CallOptions,
  ): Promise<ChatBskyConvoUpdateAllRead.Response> {
    return this._client.call(
      'chat.bsky.convo.updateAllRead',
      opts?.qp,
      data,
      opts,
    )
  }

  updateRead(
    data?: ChatBskyConvoUpdateRead.InputSchema,
    opts?: ChatBskyConvoUpdateRead.CallOptions,
  ): Promise<ChatBskyConvoUpdateRead.Response> {
    return this._client.call('chat.bsky.convo.updateRead', opts?.qp, data, opts)
  }
}

export class ChatBskyModerationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getActorMetadata(
    params?: ChatBskyModerationGetActorMetadata.QueryParams,
    opts?: ChatBskyModerationGetActorMetadata.CallOptions,
  ): Promise<ChatBskyModerationGetActorMetadata.Response> {
    return this._client.call(
      'chat.bsky.moderation.getActorMetadata',
      params,
      undefined,
      opts,
    )
  }

  getMessageContext(
    params?: ChatBskyModerationGetMessageContext.QueryParams,
    opts?: ChatBskyModerationGetMessageContext.CallOptions,
  ): Promise<ChatBskyModerationGetMessageContext.Response> {
    return this._client.call(
      'chat.bsky.moderation.getMessageContext',
      params,
      undefined,
      opts,
    )
  }

  updateActorAccess(
    data?: ChatBskyModerationUpdateActorAccess.InputSchema,
    opts?: ChatBskyModerationUpdateActorAccess.CallOptions,
  ): Promise<ChatBskyModerationUpdateActorAccess.Response> {
    return this._client.call(
      'chat.bsky.moderation.updateActorAccess',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class ToolsNS {
  _client: XrpcClient
  ozone: ToolsOzoneNS

  constructor(client: XrpcClient) {
    this._client = client
    this.ozone = new ToolsOzoneNS(client)
  }
}

export class ToolsOzoneNS {
  _client: XrpcClient
  communication: ToolsOzoneCommunicationNS
  hosting: ToolsOzoneHostingNS
  moderation: ToolsOzoneModerationNS
  safelink: ToolsOzoneSafelinkNS
  server: ToolsOzoneServerNS
  set: ToolsOzoneSetNS
  setting: ToolsOzoneSettingNS
  signature: ToolsOzoneSignatureNS
  team: ToolsOzoneTeamNS
  verification: ToolsOzoneVerificationNS

  constructor(client: XrpcClient) {
    this._client = client
    this.communication = new ToolsOzoneCommunicationNS(client)
    this.hosting = new ToolsOzoneHostingNS(client)
    this.moderation = new ToolsOzoneModerationNS(client)
    this.safelink = new ToolsOzoneSafelinkNS(client)
    this.server = new ToolsOzoneServerNS(client)
    this.set = new ToolsOzoneSetNS(client)
    this.setting = new ToolsOzoneSettingNS(client)
    this.signature = new ToolsOzoneSignatureNS(client)
    this.team = new ToolsOzoneTeamNS(client)
    this.verification = new ToolsOzoneVerificationNS(client)
  }
}

export class ToolsOzoneCommunicationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  createTemplate(
    data?: ToolsOzoneCommunicationCreateTemplate.InputSchema,
    opts?: ToolsOzoneCommunicationCreateTemplate.CallOptions,
  ): Promise<ToolsOzoneCommunicationCreateTemplate.Response> {
    return this._client
      .call('tools.ozone.communication.createTemplate', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneCommunicationCreateTemplate.toKnownErr(e)
      })
  }

  deleteTemplate(
    data?: ToolsOzoneCommunicationDeleteTemplate.InputSchema,
    opts?: ToolsOzoneCommunicationDeleteTemplate.CallOptions,
  ): Promise<ToolsOzoneCommunicationDeleteTemplate.Response> {
    return this._client.call(
      'tools.ozone.communication.deleteTemplate',
      opts?.qp,
      data,
      opts,
    )
  }

  listTemplates(
    params?: ToolsOzoneCommunicationListTemplates.QueryParams,
    opts?: ToolsOzoneCommunicationListTemplates.CallOptions,
  ): Promise<ToolsOzoneCommunicationListTemplates.Response> {
    return this._client.call(
      'tools.ozone.communication.listTemplates',
      params,
      undefined,
      opts,
    )
  }

  updateTemplate(
    data?: ToolsOzoneCommunicationUpdateTemplate.InputSchema,
    opts?: ToolsOzoneCommunicationUpdateTemplate.CallOptions,
  ): Promise<ToolsOzoneCommunicationUpdateTemplate.Response> {
    return this._client
      .call('tools.ozone.communication.updateTemplate', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneCommunicationUpdateTemplate.toKnownErr(e)
      })
  }
}

export class ToolsOzoneHostingNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getAccountHistory(
    params?: ToolsOzoneHostingGetAccountHistory.QueryParams,
    opts?: ToolsOzoneHostingGetAccountHistory.CallOptions,
  ): Promise<ToolsOzoneHostingGetAccountHistory.Response> {
    return this._client.call(
      'tools.ozone.hosting.getAccountHistory',
      params,
      undefined,
      opts,
    )
  }
}

export class ToolsOzoneModerationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  emitEvent(
    data?: ToolsOzoneModerationEmitEvent.InputSchema,
    opts?: ToolsOzoneModerationEmitEvent.CallOptions,
  ): Promise<ToolsOzoneModerationEmitEvent.Response> {
    return this._client
      .call('tools.ozone.moderation.emitEvent', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneModerationEmitEvent.toKnownErr(e)
      })
  }

  getAccountTimeline(
    params?: ToolsOzoneModerationGetAccountTimeline.QueryParams,
    opts?: ToolsOzoneModerationGetAccountTimeline.CallOptions,
  ): Promise<ToolsOzoneModerationGetAccountTimeline.Response> {
    return this._client
      .call(
        'tools.ozone.moderation.getAccountTimeline',
        params,
        undefined,
        opts,
      )
      .catch((e) => {
        throw ToolsOzoneModerationGetAccountTimeline.toKnownErr(e)
      })
  }

  getEvent(
    params?: ToolsOzoneModerationGetEvent.QueryParams,
    opts?: ToolsOzoneModerationGetEvent.CallOptions,
  ): Promise<ToolsOzoneModerationGetEvent.Response> {
    return this._client.call(
      'tools.ozone.moderation.getEvent',
      params,
      undefined,
      opts,
    )
  }

  getRecord(
    params?: ToolsOzoneModerationGetRecord.QueryParams,
    opts?: ToolsOzoneModerationGetRecord.CallOptions,
  ): Promise<ToolsOzoneModerationGetRecord.Response> {
    return this._client
      .call('tools.ozone.moderation.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ToolsOzoneModerationGetRecord.toKnownErr(e)
      })
  }

  getRecords(
    params?: ToolsOzoneModerationGetRecords.QueryParams,
    opts?: ToolsOzoneModerationGetRecords.CallOptions,
  ): Promise<ToolsOzoneModerationGetRecords.Response> {
    return this._client.call(
      'tools.ozone.moderation.getRecords',
      params,
      undefined,
      opts,
    )
  }

  getRepo(
    params?: ToolsOzoneModerationGetRepo.QueryParams,
    opts?: ToolsOzoneModerationGetRepo.CallOptions,
  ): Promise<ToolsOzoneModerationGetRepo.Response> {
    return this._client
      .call('tools.ozone.moderation.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ToolsOzoneModerationGetRepo.toKnownErr(e)
      })
  }

  getReporterStats(
    params?: ToolsOzoneModerationGetReporterStats.QueryParams,
    opts?: ToolsOzoneModerationGetReporterStats.CallOptions,
  ): Promise<ToolsOzoneModerationGetReporterStats.Response> {
    return this._client.call(
      'tools.ozone.moderation.getReporterStats',
      params,
      undefined,
      opts,
    )
  }

  getRepos(
    params?: ToolsOzoneModerationGetRepos.QueryParams,
    opts?: ToolsOzoneModerationGetRepos.CallOptions,
  ): Promise<ToolsOzoneModerationGetRepos.Response> {
    return this._client.call(
      'tools.ozone.moderation.getRepos',
      params,
      undefined,
      opts,
    )
  }

  getSubjects(
    params?: ToolsOzoneModerationGetSubjects.QueryParams,
    opts?: ToolsOzoneModerationGetSubjects.CallOptions,
  ): Promise<ToolsOzoneModerationGetSubjects.Response> {
    return this._client.call(
      'tools.ozone.moderation.getSubjects',
      params,
      undefined,
      opts,
    )
  }

  queryEvents(
    params?: ToolsOzoneModerationQueryEvents.QueryParams,
    opts?: ToolsOzoneModerationQueryEvents.CallOptions,
  ): Promise<ToolsOzoneModerationQueryEvents.Response> {
    return this._client.call(
      'tools.ozone.moderation.queryEvents',
      params,
      undefined,
      opts,
    )
  }

  queryStatuses(
    params?: ToolsOzoneModerationQueryStatuses.QueryParams,
    opts?: ToolsOzoneModerationQueryStatuses.CallOptions,
  ): Promise<ToolsOzoneModerationQueryStatuses.Response> {
    return this._client.call(
      'tools.ozone.moderation.queryStatuses',
      params,
      undefined,
      opts,
    )
  }

  searchRepos(
    params?: ToolsOzoneModerationSearchRepos.QueryParams,
    opts?: ToolsOzoneModerationSearchRepos.CallOptions,
  ): Promise<ToolsOzoneModerationSearchRepos.Response> {
    return this._client.call(
      'tools.ozone.moderation.searchRepos',
      params,
      undefined,
      opts,
    )
  }
}

export class ToolsOzoneSafelinkNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  addRule(
    data?: ToolsOzoneSafelinkAddRule.InputSchema,
    opts?: ToolsOzoneSafelinkAddRule.CallOptions,
  ): Promise<ToolsOzoneSafelinkAddRule.Response> {
    return this._client
      .call('tools.ozone.safelink.addRule', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSafelinkAddRule.toKnownErr(e)
      })
  }

  queryEvents(
    data?: ToolsOzoneSafelinkQueryEvents.InputSchema,
    opts?: ToolsOzoneSafelinkQueryEvents.CallOptions,
  ): Promise<ToolsOzoneSafelinkQueryEvents.Response> {
    return this._client.call(
      'tools.ozone.safelink.queryEvents',
      opts?.qp,
      data,
      opts,
    )
  }

  queryRules(
    data?: ToolsOzoneSafelinkQueryRules.InputSchema,
    opts?: ToolsOzoneSafelinkQueryRules.CallOptions,
  ): Promise<ToolsOzoneSafelinkQueryRules.Response> {
    return this._client.call(
      'tools.ozone.safelink.queryRules',
      opts?.qp,
      data,
      opts,
    )
  }

  removeRule(
    data?: ToolsOzoneSafelinkRemoveRule.InputSchema,
    opts?: ToolsOzoneSafelinkRemoveRule.CallOptions,
  ): Promise<ToolsOzoneSafelinkRemoveRule.Response> {
    return this._client
      .call('tools.ozone.safelink.removeRule', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSafelinkRemoveRule.toKnownErr(e)
      })
  }

  updateRule(
    data?: ToolsOzoneSafelinkUpdateRule.InputSchema,
    opts?: ToolsOzoneSafelinkUpdateRule.CallOptions,
  ): Promise<ToolsOzoneSafelinkUpdateRule.Response> {
    return this._client
      .call('tools.ozone.safelink.updateRule', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSafelinkUpdateRule.toKnownErr(e)
      })
  }
}

export class ToolsOzoneServerNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getConfig(
    params?: ToolsOzoneServerGetConfig.QueryParams,
    opts?: ToolsOzoneServerGetConfig.CallOptions,
  ): Promise<ToolsOzoneServerGetConfig.Response> {
    return this._client.call(
      'tools.ozone.server.getConfig',
      params,
      undefined,
      opts,
    )
  }
}

export class ToolsOzoneSetNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  addValues(
    data?: ToolsOzoneSetAddValues.InputSchema,
    opts?: ToolsOzoneSetAddValues.CallOptions,
  ): Promise<ToolsOzoneSetAddValues.Response> {
    return this._client.call('tools.ozone.set.addValues', opts?.qp, data, opts)
  }

  deleteSet(
    data?: ToolsOzoneSetDeleteSet.InputSchema,
    opts?: ToolsOzoneSetDeleteSet.CallOptions,
  ): Promise<ToolsOzoneSetDeleteSet.Response> {
    return this._client
      .call('tools.ozone.set.deleteSet', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSetDeleteSet.toKnownErr(e)
      })
  }

  deleteValues(
    data?: ToolsOzoneSetDeleteValues.InputSchema,
    opts?: ToolsOzoneSetDeleteValues.CallOptions,
  ): Promise<ToolsOzoneSetDeleteValues.Response> {
    return this._client
      .call('tools.ozone.set.deleteValues', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSetDeleteValues.toKnownErr(e)
      })
  }

  getValues(
    params?: ToolsOzoneSetGetValues.QueryParams,
    opts?: ToolsOzoneSetGetValues.CallOptions,
  ): Promise<ToolsOzoneSetGetValues.Response> {
    return this._client
      .call('tools.ozone.set.getValues', params, undefined, opts)
      .catch((e) => {
        throw ToolsOzoneSetGetValues.toKnownErr(e)
      })
  }

  querySets(
    params?: ToolsOzoneSetQuerySets.QueryParams,
    opts?: ToolsOzoneSetQuerySets.CallOptions,
  ): Promise<ToolsOzoneSetQuerySets.Response> {
    return this._client.call(
      'tools.ozone.set.querySets',
      params,
      undefined,
      opts,
    )
  }

  upsertSet(
    data?: ToolsOzoneSetUpsertSet.InputSchema,
    opts?: ToolsOzoneSetUpsertSet.CallOptions,
  ): Promise<ToolsOzoneSetUpsertSet.Response> {
    return this._client.call('tools.ozone.set.upsertSet', opts?.qp, data, opts)
  }
}

export class ToolsOzoneSettingNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  listOptions(
    params?: ToolsOzoneSettingListOptions.QueryParams,
    opts?: ToolsOzoneSettingListOptions.CallOptions,
  ): Promise<ToolsOzoneSettingListOptions.Response> {
    return this._client.call(
      'tools.ozone.setting.listOptions',
      params,
      undefined,
      opts,
    )
  }

  removeOptions(
    data?: ToolsOzoneSettingRemoveOptions.InputSchema,
    opts?: ToolsOzoneSettingRemoveOptions.CallOptions,
  ): Promise<ToolsOzoneSettingRemoveOptions.Response> {
    return this._client.call(
      'tools.ozone.setting.removeOptions',
      opts?.qp,
      data,
      opts,
    )
  }

  upsertOption(
    data?: ToolsOzoneSettingUpsertOption.InputSchema,
    opts?: ToolsOzoneSettingUpsertOption.CallOptions,
  ): Promise<ToolsOzoneSettingUpsertOption.Response> {
    return this._client.call(
      'tools.ozone.setting.upsertOption',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class ToolsOzoneSignatureNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  findCorrelation(
    params?: ToolsOzoneSignatureFindCorrelation.QueryParams,
    opts?: ToolsOzoneSignatureFindCorrelation.CallOptions,
  ): Promise<ToolsOzoneSignatureFindCorrelation.Response> {
    return this._client.call(
      'tools.ozone.signature.findCorrelation',
      params,
      undefined,
      opts,
    )
  }

  findRelatedAccounts(
    params?: ToolsOzoneSignatureFindRelatedAccounts.QueryParams,
    opts?: ToolsOzoneSignatureFindRelatedAccounts.CallOptions,
  ): Promise<ToolsOzoneSignatureFindRelatedAccounts.Response> {
    return this._client.call(
      'tools.ozone.signature.findRelatedAccounts',
      params,
      undefined,
      opts,
    )
  }

  searchAccounts(
    params?: ToolsOzoneSignatureSearchAccounts.QueryParams,
    opts?: ToolsOzoneSignatureSearchAccounts.CallOptions,
  ): Promise<ToolsOzoneSignatureSearchAccounts.Response> {
    return this._client.call(
      'tools.ozone.signature.searchAccounts',
      params,
      undefined,
      opts,
    )
  }
}

export class ToolsOzoneTeamNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  addMember(
    data?: ToolsOzoneTeamAddMember.InputSchema,
    opts?: ToolsOzoneTeamAddMember.CallOptions,
  ): Promise<ToolsOzoneTeamAddMember.Response> {
    return this._client
      .call('tools.ozone.team.addMember', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneTeamAddMember.toKnownErr(e)
      })
  }

  deleteMember(
    data?: ToolsOzoneTeamDeleteMember.InputSchema,
    opts?: ToolsOzoneTeamDeleteMember.CallOptions,
  ): Promise<ToolsOzoneTeamDeleteMember.Response> {
    return this._client
      .call('tools.ozone.team.deleteMember', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneTeamDeleteMember.toKnownErr(e)
      })
  }

  listMembers(
    params?: ToolsOzoneTeamListMembers.QueryParams,
    opts?: ToolsOzoneTeamListMembers.CallOptions,
  ): Promise<ToolsOzoneTeamListMembers.Response> {
    return this._client.call(
      'tools.ozone.team.listMembers',
      params,
      undefined,
      opts,
    )
  }

  updateMember(
    data?: ToolsOzoneTeamUpdateMember.InputSchema,
    opts?: ToolsOzoneTeamUpdateMember.CallOptions,
  ): Promise<ToolsOzoneTeamUpdateMember.Response> {
    return this._client
      .call('tools.ozone.team.updateMember', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneTeamUpdateMember.toKnownErr(e)
      })
  }
}

export class ToolsOzoneVerificationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  grantVerifications(
    data?: ToolsOzoneVerificationGrantVerifications.InputSchema,
    opts?: ToolsOzoneVerificationGrantVerifications.CallOptions,
  ): Promise<ToolsOzoneVerificationGrantVerifications.Response> {
    return this._client.call(
      'tools.ozone.verification.grantVerifications',
      opts?.qp,
      data,
      opts,
    )
  }

  listVerifications(
    params?: ToolsOzoneVerificationListVerifications.QueryParams,
    opts?: ToolsOzoneVerificationListVerifications.CallOptions,
  ): Promise<ToolsOzoneVerificationListVerifications.Response> {
    return this._client.call(
      'tools.ozone.verification.listVerifications',
      params,
      undefined,
      opts,
    )
  }

  revokeVerifications(
    data?: ToolsOzoneVerificationRevokeVerifications.InputSchema,
    opts?: ToolsOzoneVerificationRevokeVerifications.CallOptions,
  ): Promise<ToolsOzoneVerificationRevokeVerifications.Response> {
    return this._client.call(
      'tools.ozone.verification.revokeVerifications',
      opts?.qp,
      data,
      opts,
    )
  }
}

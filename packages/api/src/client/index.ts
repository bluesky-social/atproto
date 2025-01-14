/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { XrpcClient, FetchHandler, FetchHandlerOptions } from '@atproto/xrpc'
import { schemas } from './lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from './types/com/atproto/admin/defs'
import * as ComAtprotoAdminDeleteAccount from './types/com/atproto/admin/deleteAccount'
import * as ComAtprotoAdminDisableAccountInvites from './types/com/atproto/admin/disableAccountInvites'
import * as ComAtprotoAdminDisableInviteCodes from './types/com/atproto/admin/disableInviteCodes'
import * as ComAtprotoAdminEnableAccountInvites from './types/com/atproto/admin/enableAccountInvites'
import * as ComAtprotoAdminGetAccountInfo from './types/com/atproto/admin/getAccountInfo'
import * as ComAtprotoAdminGetAccountInfos from './types/com/atproto/admin/getAccountInfos'
import * as ComAtprotoAdminGetInviteCodes from './types/com/atproto/admin/getInviteCodes'
import * as ComAtprotoAdminGetSubjectStatus from './types/com/atproto/admin/getSubjectStatus'
import * as ComAtprotoAdminSearchAccounts from './types/com/atproto/admin/searchAccounts'
import * as ComAtprotoAdminSendEmail from './types/com/atproto/admin/sendEmail'
import * as ComAtprotoAdminUpdateAccountEmail from './types/com/atproto/admin/updateAccountEmail'
import * as ComAtprotoAdminUpdateAccountHandle from './types/com/atproto/admin/updateAccountHandle'
import * as ComAtprotoAdminUpdateAccountPassword from './types/com/atproto/admin/updateAccountPassword'
import * as ComAtprotoAdminUpdateSubjectStatus from './types/com/atproto/admin/updateSubjectStatus'
import * as ComAtprotoIdentityGetRecommendedDidCredentials from './types/com/atproto/identity/getRecommendedDidCredentials'
import * as ComAtprotoIdentityRequestPlcOperationSignature from './types/com/atproto/identity/requestPlcOperationSignature'
import * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle'
import * as ComAtprotoIdentitySignPlcOperation from './types/com/atproto/identity/signPlcOperation'
import * as ComAtprotoIdentitySubmitPlcOperation from './types/com/atproto/identity/submitPlcOperation'
import * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle'
import * as ComAtprotoLabelDefs from './types/com/atproto/label/defs'
import * as ComAtprotoLabelQueryLabels from './types/com/atproto/label/queryLabels'
import * as ComAtprotoLabelSubscribeLabels from './types/com/atproto/label/subscribeLabels'
import * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport'
import * as ComAtprotoModerationDefs from './types/com/atproto/moderation/defs'
import * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
import * as ComAtprotoRepoDefs from './types/com/atproto/repo/defs'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
import * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
import * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo'
import * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
import * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef'
import * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob'
import * as ComAtprotoServerActivateAccount from './types/com/atproto/server/activateAccount'
import * as ComAtprotoServerCheckAccountStatus from './types/com/atproto/server/checkAccountStatus'
import * as ComAtprotoServerConfirmEmail from './types/com/atproto/server/confirmEmail'
import * as ComAtprotoServerCreateAccount from './types/com/atproto/server/createAccount'
import * as ComAtprotoServerCreateAppPassword from './types/com/atproto/server/createAppPassword'
import * as ComAtprotoServerCreateInviteCode from './types/com/atproto/server/createInviteCode'
import * as ComAtprotoServerCreateInviteCodes from './types/com/atproto/server/createInviteCodes'
import * as ComAtprotoServerCreateSession from './types/com/atproto/server/createSession'
import * as ComAtprotoServerDeactivateAccount from './types/com/atproto/server/deactivateAccount'
import * as ComAtprotoServerDefs from './types/com/atproto/server/defs'
import * as ComAtprotoServerDeleteAccount from './types/com/atproto/server/deleteAccount'
import * as ComAtprotoServerDeleteSession from './types/com/atproto/server/deleteSession'
import * as ComAtprotoServerDescribeServer from './types/com/atproto/server/describeServer'
import * as ComAtprotoServerGetAccountInviteCodes from './types/com/atproto/server/getAccountInviteCodes'
import * as ComAtprotoServerGetServiceAuth from './types/com/atproto/server/getServiceAuth'
import * as ComAtprotoServerGetSession from './types/com/atproto/server/getSession'
import * as ComAtprotoServerListAppPasswords from './types/com/atproto/server/listAppPasswords'
import * as ComAtprotoServerRefreshSession from './types/com/atproto/server/refreshSession'
import * as ComAtprotoServerRequestAccountDelete from './types/com/atproto/server/requestAccountDelete'
import * as ComAtprotoServerRequestEmailConfirmation from './types/com/atproto/server/requestEmailConfirmation'
import * as ComAtprotoServerRequestEmailUpdate from './types/com/atproto/server/requestEmailUpdate'
import * as ComAtprotoServerRequestPasswordReset from './types/com/atproto/server/requestPasswordReset'
import * as ComAtprotoServerReserveSigningKey from './types/com/atproto/server/reserveSigningKey'
import * as ComAtprotoServerResetPassword from './types/com/atproto/server/resetPassword'
import * as ComAtprotoServerRevokeAppPassword from './types/com/atproto/server/revokeAppPassword'
import * as ComAtprotoServerUpdateEmail from './types/com/atproto/server/updateEmail'
import * as ComAtprotoSyncGetBlob from './types/com/atproto/sync/getBlob'
import * as ComAtprotoSyncGetBlocks from './types/com/atproto/sync/getBlocks'
import * as ComAtprotoSyncGetCheckout from './types/com/atproto/sync/getCheckout'
import * as ComAtprotoSyncGetHead from './types/com/atproto/sync/getHead'
import * as ComAtprotoSyncGetLatestCommit from './types/com/atproto/sync/getLatestCommit'
import * as ComAtprotoSyncGetRecord from './types/com/atproto/sync/getRecord'
import * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo'
import * as ComAtprotoSyncGetRepoStatus from './types/com/atproto/sync/getRepoStatus'
import * as ComAtprotoSyncListBlobs from './types/com/atproto/sync/listBlobs'
import * as ComAtprotoSyncListRepos from './types/com/atproto/sync/listRepos'
import * as ComAtprotoSyncNotifyOfUpdate from './types/com/atproto/sync/notifyOfUpdate'
import * as ComAtprotoSyncRequestCrawl from './types/com/atproto/sync/requestCrawl'
import * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos'
import * as ComAtprotoTempAddReservedHandle from './types/com/atproto/temp/addReservedHandle'
import * as ComAtprotoTempCheckSignupQueue from './types/com/atproto/temp/checkSignupQueue'
import * as ComAtprotoTempFetchLabels from './types/com/atproto/temp/fetchLabels'
import * as ComAtprotoTempRequestPhoneVerification from './types/com/atproto/temp/requestPhoneVerification'
import * as AppBskyActorDefs from './types/app/bsky/actor/defs'
import * as AppBskyActorGetPreferences from './types/app/bsky/actor/getPreferences'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
import * as AppBskyActorProfile from './types/app/bsky/actor/profile'
import * as AppBskyActorPutPreferences from './types/app/bsky/actor/putPreferences'
import * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors'
import * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead'
import * as AppBskyEmbedDefs from './types/app/bsky/embed/defs'
import * as AppBskyEmbedExternal from './types/app/bsky/embed/external'
import * as AppBskyEmbedImages from './types/app/bsky/embed/images'
import * as AppBskyEmbedRecord from './types/app/bsky/embed/record'
import * as AppBskyEmbedRecordWithMedia from './types/app/bsky/embed/recordWithMedia'
import * as AppBskyEmbedVideo from './types/app/bsky/embed/video'
import * as AppBskyFeedDefs from './types/app/bsky/feed/defs'
import * as AppBskyFeedDescribeFeedGenerator from './types/app/bsky/feed/describeFeedGenerator'
import * as AppBskyFeedGenerator from './types/app/bsky/feed/generator'
import * as AppBskyFeedGetActorFeeds from './types/app/bsky/feed/getActorFeeds'
import * as AppBskyFeedGetActorLikes from './types/app/bsky/feed/getActorLikes'
import * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
import * as AppBskyFeedGetFeed from './types/app/bsky/feed/getFeed'
import * as AppBskyFeedGetFeedGenerator from './types/app/bsky/feed/getFeedGenerator'
import * as AppBskyFeedGetFeedGenerators from './types/app/bsky/feed/getFeedGenerators'
import * as AppBskyFeedGetFeedSkeleton from './types/app/bsky/feed/getFeedSkeleton'
import * as AppBskyFeedGetLikes from './types/app/bsky/feed/getLikes'
import * as AppBskyFeedGetListFeed from './types/app/bsky/feed/getListFeed'
import * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
import * as AppBskyFeedGetPosts from './types/app/bsky/feed/getPosts'
import * as AppBskyFeedGetQuotes from './types/app/bsky/feed/getQuotes'
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
import * as AppBskyFeedGetSuggestedFeeds from './types/app/bsky/feed/getSuggestedFeeds'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
import * as AppBskyFeedLike from './types/app/bsky/feed/like'
import * as AppBskyFeedPost from './types/app/bsky/feed/post'
import * as AppBskyFeedPostgate from './types/app/bsky/feed/postgate'
import * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
import * as AppBskyFeedSearchPosts from './types/app/bsky/feed/searchPosts'
import * as AppBskyFeedSendInteractions from './types/app/bsky/feed/sendInteractions'
import * as AppBskyFeedThreadgate from './types/app/bsky/feed/threadgate'
import * as AppBskyGraphBlock from './types/app/bsky/graph/block'
import * as AppBskyGraphDefs from './types/app/bsky/graph/defs'
import * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
import * as AppBskyGraphGetActorStarterPacks from './types/app/bsky/graph/getActorStarterPacks'
import * as AppBskyGraphGetBlocks from './types/app/bsky/graph/getBlocks'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyGraphGetKnownFollowers from './types/app/bsky/graph/getKnownFollowers'
import * as AppBskyGraphGetList from './types/app/bsky/graph/getList'
import * as AppBskyGraphGetListBlocks from './types/app/bsky/graph/getListBlocks'
import * as AppBskyGraphGetListMutes from './types/app/bsky/graph/getListMutes'
import * as AppBskyGraphGetLists from './types/app/bsky/graph/getLists'
import * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
import * as AppBskyGraphGetRelationships from './types/app/bsky/graph/getRelationships'
import * as AppBskyGraphGetStarterPack from './types/app/bsky/graph/getStarterPack'
import * as AppBskyGraphGetStarterPacks from './types/app/bsky/graph/getStarterPacks'
import * as AppBskyGraphGetSuggestedFollowsByActor from './types/app/bsky/graph/getSuggestedFollowsByActor'
import * as AppBskyGraphList from './types/app/bsky/graph/list'
import * as AppBskyGraphListblock from './types/app/bsky/graph/listblock'
import * as AppBskyGraphListitem from './types/app/bsky/graph/listitem'
import * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor'
import * as AppBskyGraphMuteActorList from './types/app/bsky/graph/muteActorList'
import * as AppBskyGraphMuteThread from './types/app/bsky/graph/muteThread'
import * as AppBskyGraphSearchStarterPacks from './types/app/bsky/graph/searchStarterPacks'
import * as AppBskyGraphStarterpack from './types/app/bsky/graph/starterpack'
import * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor'
import * as AppBskyGraphUnmuteActorList from './types/app/bsky/graph/unmuteActorList'
import * as AppBskyGraphUnmuteThread from './types/app/bsky/graph/unmuteThread'
import * as AppBskyLabelerDefs from './types/app/bsky/labeler/defs'
import * as AppBskyLabelerGetServices from './types/app/bsky/labeler/getServices'
import * as AppBskyLabelerService from './types/app/bsky/labeler/service'
import * as AppBskyNotificationGetUnreadCount from './types/app/bsky/notification/getUnreadCount'
import * as AppBskyNotificationListNotifications from './types/app/bsky/notification/listNotifications'
import * as AppBskyNotificationPutPreferences from './types/app/bsky/notification/putPreferences'
import * as AppBskyNotificationRegisterPush from './types/app/bsky/notification/registerPush'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
import * as AppBskyRichtextFacet from './types/app/bsky/richtext/facet'
import * as AppBskyUnspeccedDefs from './types/app/bsky/unspecced/defs'
import * as AppBskyUnspeccedGetConfig from './types/app/bsky/unspecced/getConfig'
import * as AppBskyUnspeccedGetPopularFeedGenerators from './types/app/bsky/unspecced/getPopularFeedGenerators'
import * as AppBskyUnspeccedGetSuggestionsSkeleton from './types/app/bsky/unspecced/getSuggestionsSkeleton'
import * as AppBskyUnspeccedGetTaggedSuggestions from './types/app/bsky/unspecced/getTaggedSuggestions'
import * as AppBskyUnspeccedGetTrendingTopics from './types/app/bsky/unspecced/getTrendingTopics'
import * as AppBskyUnspeccedSearchActorsSkeleton from './types/app/bsky/unspecced/searchActorsSkeleton'
import * as AppBskyUnspeccedSearchPostsSkeleton from './types/app/bsky/unspecced/searchPostsSkeleton'
import * as AppBskyUnspeccedSearchStarterPacksSkeleton from './types/app/bsky/unspecced/searchStarterPacksSkeleton'
import * as AppBskyVideoDefs from './types/app/bsky/video/defs'
import * as AppBskyVideoGetJobStatus from './types/app/bsky/video/getJobStatus'
import * as AppBskyVideoGetUploadLimits from './types/app/bsky/video/getUploadLimits'
import * as AppBskyVideoUploadVideo from './types/app/bsky/video/uploadVideo'
import * as ChatBskyActorDeclaration from './types/chat/bsky/actor/declaration'
import * as ChatBskyActorDefs from './types/chat/bsky/actor/defs'
import * as ChatBskyActorDeleteAccount from './types/chat/bsky/actor/deleteAccount'
import * as ChatBskyActorExportAccountData from './types/chat/bsky/actor/exportAccountData'
import * as ChatBskyConvoDefs from './types/chat/bsky/convo/defs'
import * as ChatBskyConvoDeleteMessageForSelf from './types/chat/bsky/convo/deleteMessageForSelf'
import * as ChatBskyConvoGetConvo from './types/chat/bsky/convo/getConvo'
import * as ChatBskyConvoGetConvoForMembers from './types/chat/bsky/convo/getConvoForMembers'
import * as ChatBskyConvoGetLog from './types/chat/bsky/convo/getLog'
import * as ChatBskyConvoGetMessages from './types/chat/bsky/convo/getMessages'
import * as ChatBskyConvoLeaveConvo from './types/chat/bsky/convo/leaveConvo'
import * as ChatBskyConvoListConvos from './types/chat/bsky/convo/listConvos'
import * as ChatBskyConvoMuteConvo from './types/chat/bsky/convo/muteConvo'
import * as ChatBskyConvoSendMessage from './types/chat/bsky/convo/sendMessage'
import * as ChatBskyConvoSendMessageBatch from './types/chat/bsky/convo/sendMessageBatch'
import * as ChatBskyConvoUnmuteConvo from './types/chat/bsky/convo/unmuteConvo'
import * as ChatBskyConvoUpdateRead from './types/chat/bsky/convo/updateRead'
import * as ChatBskyModerationGetActorMetadata from './types/chat/bsky/moderation/getActorMetadata'
import * as ChatBskyModerationGetMessageContext from './types/chat/bsky/moderation/getMessageContext'
import * as ChatBskyModerationUpdateActorAccess from './types/chat/bsky/moderation/updateActorAccess'
import * as ToolsOzoneCommunicationCreateTemplate from './types/tools/ozone/communication/createTemplate'
import * as ToolsOzoneCommunicationDefs from './types/tools/ozone/communication/defs'
import * as ToolsOzoneCommunicationDeleteTemplate from './types/tools/ozone/communication/deleteTemplate'
import * as ToolsOzoneCommunicationListTemplates from './types/tools/ozone/communication/listTemplates'
import * as ToolsOzoneCommunicationUpdateTemplate from './types/tools/ozone/communication/updateTemplate'
import * as ToolsOzoneModerationDefs from './types/tools/ozone/moderation/defs'
import * as ToolsOzoneModerationEmitEvent from './types/tools/ozone/moderation/emitEvent'
import * as ToolsOzoneModerationGetEvent from './types/tools/ozone/moderation/getEvent'
import * as ToolsOzoneModerationGetRecord from './types/tools/ozone/moderation/getRecord'
import * as ToolsOzoneModerationGetRecords from './types/tools/ozone/moderation/getRecords'
import * as ToolsOzoneModerationGetRepo from './types/tools/ozone/moderation/getRepo'
import * as ToolsOzoneModerationGetRepos from './types/tools/ozone/moderation/getRepos'
import * as ToolsOzoneModerationQueryEvents from './types/tools/ozone/moderation/queryEvents'
import * as ToolsOzoneModerationQueryStatuses from './types/tools/ozone/moderation/queryStatuses'
import * as ToolsOzoneModerationSearchRepos from './types/tools/ozone/moderation/searchRepos'
import * as ToolsOzoneServerGetConfig from './types/tools/ozone/server/getConfig'
import * as ToolsOzoneSetAddValues from './types/tools/ozone/set/addValues'
import * as ToolsOzoneSetDefs from './types/tools/ozone/set/defs'
import * as ToolsOzoneSetDeleteSet from './types/tools/ozone/set/deleteSet'
import * as ToolsOzoneSetDeleteValues from './types/tools/ozone/set/deleteValues'
import * as ToolsOzoneSetGetValues from './types/tools/ozone/set/getValues'
import * as ToolsOzoneSetQuerySets from './types/tools/ozone/set/querySets'
import * as ToolsOzoneSetUpsertSet from './types/tools/ozone/set/upsertSet'
import * as ToolsOzoneSettingDefs from './types/tools/ozone/setting/defs'
import * as ToolsOzoneSettingListOptions from './types/tools/ozone/setting/listOptions'
import * as ToolsOzoneSettingRemoveOptions from './types/tools/ozone/setting/removeOptions'
import * as ToolsOzoneSettingUpsertOption from './types/tools/ozone/setting/upsertOption'
import * as ToolsOzoneSignatureDefs from './types/tools/ozone/signature/defs'
import * as ToolsOzoneSignatureFindCorrelation from './types/tools/ozone/signature/findCorrelation'
import * as ToolsOzoneSignatureFindRelatedAccounts from './types/tools/ozone/signature/findRelatedAccounts'
import * as ToolsOzoneSignatureSearchAccounts from './types/tools/ozone/signature/searchAccounts'
import * as ToolsOzoneTeamAddMember from './types/tools/ozone/team/addMember'
import * as ToolsOzoneTeamDefs from './types/tools/ozone/team/defs'
import * as ToolsOzoneTeamDeleteMember from './types/tools/ozone/team/deleteMember'
import * as ToolsOzoneTeamListMembers from './types/tools/ozone/team/listMembers'
import * as ToolsOzoneTeamUpdateMember from './types/tools/ozone/team/updateMember'

export * as ComAtprotoAdminDefs from './types/com/atproto/admin/defs'
export * as ComAtprotoAdminDeleteAccount from './types/com/atproto/admin/deleteAccount'
export * as ComAtprotoAdminDisableAccountInvites from './types/com/atproto/admin/disableAccountInvites'
export * as ComAtprotoAdminDisableInviteCodes from './types/com/atproto/admin/disableInviteCodes'
export * as ComAtprotoAdminEnableAccountInvites from './types/com/atproto/admin/enableAccountInvites'
export * as ComAtprotoAdminGetAccountInfo from './types/com/atproto/admin/getAccountInfo'
export * as ComAtprotoAdminGetAccountInfos from './types/com/atproto/admin/getAccountInfos'
export * as ComAtprotoAdminGetInviteCodes from './types/com/atproto/admin/getInviteCodes'
export * as ComAtprotoAdminGetSubjectStatus from './types/com/atproto/admin/getSubjectStatus'
export * as ComAtprotoAdminSearchAccounts from './types/com/atproto/admin/searchAccounts'
export * as ComAtprotoAdminSendEmail from './types/com/atproto/admin/sendEmail'
export * as ComAtprotoAdminUpdateAccountEmail from './types/com/atproto/admin/updateAccountEmail'
export * as ComAtprotoAdminUpdateAccountHandle from './types/com/atproto/admin/updateAccountHandle'
export * as ComAtprotoAdminUpdateAccountPassword from './types/com/atproto/admin/updateAccountPassword'
export * as ComAtprotoAdminUpdateSubjectStatus from './types/com/atproto/admin/updateSubjectStatus'
export * as ComAtprotoIdentityGetRecommendedDidCredentials from './types/com/atproto/identity/getRecommendedDidCredentials'
export * as ComAtprotoIdentityRequestPlcOperationSignature from './types/com/atproto/identity/requestPlcOperationSignature'
export * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle'
export * as ComAtprotoIdentitySignPlcOperation from './types/com/atproto/identity/signPlcOperation'
export * as ComAtprotoIdentitySubmitPlcOperation from './types/com/atproto/identity/submitPlcOperation'
export * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle'
export * as ComAtprotoLabelDefs from './types/com/atproto/label/defs'
export * as ComAtprotoLabelQueryLabels from './types/com/atproto/label/queryLabels'
export * as ComAtprotoLabelSubscribeLabels from './types/com/atproto/label/subscribeLabels'
export * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport'
export * as ComAtprotoModerationDefs from './types/com/atproto/moderation/defs'
export * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites'
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
export * as ComAtprotoRepoDefs from './types/com/atproto/repo/defs'
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
export * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo'
export * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
export * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo'
export * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs'
export * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
export * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef'
export * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob'
export * as ComAtprotoServerActivateAccount from './types/com/atproto/server/activateAccount'
export * as ComAtprotoServerCheckAccountStatus from './types/com/atproto/server/checkAccountStatus'
export * as ComAtprotoServerConfirmEmail from './types/com/atproto/server/confirmEmail'
export * as ComAtprotoServerCreateAccount from './types/com/atproto/server/createAccount'
export * as ComAtprotoServerCreateAppPassword from './types/com/atproto/server/createAppPassword'
export * as ComAtprotoServerCreateInviteCode from './types/com/atproto/server/createInviteCode'
export * as ComAtprotoServerCreateInviteCodes from './types/com/atproto/server/createInviteCodes'
export * as ComAtprotoServerCreateSession from './types/com/atproto/server/createSession'
export * as ComAtprotoServerDeactivateAccount from './types/com/atproto/server/deactivateAccount'
export * as ComAtprotoServerDefs from './types/com/atproto/server/defs'
export * as ComAtprotoServerDeleteAccount from './types/com/atproto/server/deleteAccount'
export * as ComAtprotoServerDeleteSession from './types/com/atproto/server/deleteSession'
export * as ComAtprotoServerDescribeServer from './types/com/atproto/server/describeServer'
export * as ComAtprotoServerGetAccountInviteCodes from './types/com/atproto/server/getAccountInviteCodes'
export * as ComAtprotoServerGetServiceAuth from './types/com/atproto/server/getServiceAuth'
export * as ComAtprotoServerGetSession from './types/com/atproto/server/getSession'
export * as ComAtprotoServerListAppPasswords from './types/com/atproto/server/listAppPasswords'
export * as ComAtprotoServerRefreshSession from './types/com/atproto/server/refreshSession'
export * as ComAtprotoServerRequestAccountDelete from './types/com/atproto/server/requestAccountDelete'
export * as ComAtprotoServerRequestEmailConfirmation from './types/com/atproto/server/requestEmailConfirmation'
export * as ComAtprotoServerRequestEmailUpdate from './types/com/atproto/server/requestEmailUpdate'
export * as ComAtprotoServerRequestPasswordReset from './types/com/atproto/server/requestPasswordReset'
export * as ComAtprotoServerReserveSigningKey from './types/com/atproto/server/reserveSigningKey'
export * as ComAtprotoServerResetPassword from './types/com/atproto/server/resetPassword'
export * as ComAtprotoServerRevokeAppPassword from './types/com/atproto/server/revokeAppPassword'
export * as ComAtprotoServerUpdateEmail from './types/com/atproto/server/updateEmail'
export * as ComAtprotoSyncGetBlob from './types/com/atproto/sync/getBlob'
export * as ComAtprotoSyncGetBlocks from './types/com/atproto/sync/getBlocks'
export * as ComAtprotoSyncGetCheckout from './types/com/atproto/sync/getCheckout'
export * as ComAtprotoSyncGetHead from './types/com/atproto/sync/getHead'
export * as ComAtprotoSyncGetLatestCommit from './types/com/atproto/sync/getLatestCommit'
export * as ComAtprotoSyncGetRecord from './types/com/atproto/sync/getRecord'
export * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo'
export * as ComAtprotoSyncGetRepoStatus from './types/com/atproto/sync/getRepoStatus'
export * as ComAtprotoSyncListBlobs from './types/com/atproto/sync/listBlobs'
export * as ComAtprotoSyncListRepos from './types/com/atproto/sync/listRepos'
export * as ComAtprotoSyncNotifyOfUpdate from './types/com/atproto/sync/notifyOfUpdate'
export * as ComAtprotoSyncRequestCrawl from './types/com/atproto/sync/requestCrawl'
export * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos'
export * as ComAtprotoTempAddReservedHandle from './types/com/atproto/temp/addReservedHandle'
export * as ComAtprotoTempCheckSignupQueue from './types/com/atproto/temp/checkSignupQueue'
export * as ComAtprotoTempFetchLabels from './types/com/atproto/temp/fetchLabels'
export * as ComAtprotoTempRequestPhoneVerification from './types/com/atproto/temp/requestPhoneVerification'
export * as AppBskyActorDefs from './types/app/bsky/actor/defs'
export * as AppBskyActorGetPreferences from './types/app/bsky/actor/getPreferences'
export * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
export * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles'
export * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
export * as AppBskyActorProfile from './types/app/bsky/actor/profile'
export * as AppBskyActorPutPreferences from './types/app/bsky/actor/putPreferences'
export * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors'
export * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead'
export * as AppBskyEmbedDefs from './types/app/bsky/embed/defs'
export * as AppBskyEmbedExternal from './types/app/bsky/embed/external'
export * as AppBskyEmbedImages from './types/app/bsky/embed/images'
export * as AppBskyEmbedRecord from './types/app/bsky/embed/record'
export * as AppBskyEmbedRecordWithMedia from './types/app/bsky/embed/recordWithMedia'
export * as AppBskyEmbedVideo from './types/app/bsky/embed/video'
export * as AppBskyFeedDefs from './types/app/bsky/feed/defs'
export * as AppBskyFeedDescribeFeedGenerator from './types/app/bsky/feed/describeFeedGenerator'
export * as AppBskyFeedGenerator from './types/app/bsky/feed/generator'
export * as AppBskyFeedGetActorFeeds from './types/app/bsky/feed/getActorFeeds'
export * as AppBskyFeedGetActorLikes from './types/app/bsky/feed/getActorLikes'
export * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
export * as AppBskyFeedGetFeed from './types/app/bsky/feed/getFeed'
export * as AppBskyFeedGetFeedGenerator from './types/app/bsky/feed/getFeedGenerator'
export * as AppBskyFeedGetFeedGenerators from './types/app/bsky/feed/getFeedGenerators'
export * as AppBskyFeedGetFeedSkeleton from './types/app/bsky/feed/getFeedSkeleton'
export * as AppBskyFeedGetLikes from './types/app/bsky/feed/getLikes'
export * as AppBskyFeedGetListFeed from './types/app/bsky/feed/getListFeed'
export * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
export * as AppBskyFeedGetPosts from './types/app/bsky/feed/getPosts'
export * as AppBskyFeedGetQuotes from './types/app/bsky/feed/getQuotes'
export * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
export * as AppBskyFeedGetSuggestedFeeds from './types/app/bsky/feed/getSuggestedFeeds'
export * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
export * as AppBskyFeedLike from './types/app/bsky/feed/like'
export * as AppBskyFeedPost from './types/app/bsky/feed/post'
export * as AppBskyFeedPostgate from './types/app/bsky/feed/postgate'
export * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
export * as AppBskyFeedSearchPosts from './types/app/bsky/feed/searchPosts'
export * as AppBskyFeedSendInteractions from './types/app/bsky/feed/sendInteractions'
export * as AppBskyFeedThreadgate from './types/app/bsky/feed/threadgate'
export * as AppBskyGraphBlock from './types/app/bsky/graph/block'
export * as AppBskyGraphDefs from './types/app/bsky/graph/defs'
export * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
export * as AppBskyGraphGetActorStarterPacks from './types/app/bsky/graph/getActorStarterPacks'
export * as AppBskyGraphGetBlocks from './types/app/bsky/graph/getBlocks'
export * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
export * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
export * as AppBskyGraphGetKnownFollowers from './types/app/bsky/graph/getKnownFollowers'
export * as AppBskyGraphGetList from './types/app/bsky/graph/getList'
export * as AppBskyGraphGetListBlocks from './types/app/bsky/graph/getListBlocks'
export * as AppBskyGraphGetListMutes from './types/app/bsky/graph/getListMutes'
export * as AppBskyGraphGetLists from './types/app/bsky/graph/getLists'
export * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
export * as AppBskyGraphGetRelationships from './types/app/bsky/graph/getRelationships'
export * as AppBskyGraphGetStarterPack from './types/app/bsky/graph/getStarterPack'
export * as AppBskyGraphGetStarterPacks from './types/app/bsky/graph/getStarterPacks'
export * as AppBskyGraphGetSuggestedFollowsByActor from './types/app/bsky/graph/getSuggestedFollowsByActor'
export * as AppBskyGraphList from './types/app/bsky/graph/list'
export * as AppBskyGraphListblock from './types/app/bsky/graph/listblock'
export * as AppBskyGraphListitem from './types/app/bsky/graph/listitem'
export * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor'
export * as AppBskyGraphMuteActorList from './types/app/bsky/graph/muteActorList'
export * as AppBskyGraphMuteThread from './types/app/bsky/graph/muteThread'
export * as AppBskyGraphSearchStarterPacks from './types/app/bsky/graph/searchStarterPacks'
export * as AppBskyGraphStarterpack from './types/app/bsky/graph/starterpack'
export * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor'
export * as AppBskyGraphUnmuteActorList from './types/app/bsky/graph/unmuteActorList'
export * as AppBskyGraphUnmuteThread from './types/app/bsky/graph/unmuteThread'
export * as AppBskyLabelerDefs from './types/app/bsky/labeler/defs'
export * as AppBskyLabelerGetServices from './types/app/bsky/labeler/getServices'
export * as AppBskyLabelerService from './types/app/bsky/labeler/service'
export * as AppBskyNotificationGetUnreadCount from './types/app/bsky/notification/getUnreadCount'
export * as AppBskyNotificationListNotifications from './types/app/bsky/notification/listNotifications'
export * as AppBskyNotificationPutPreferences from './types/app/bsky/notification/putPreferences'
export * as AppBskyNotificationRegisterPush from './types/app/bsky/notification/registerPush'
export * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
export * as AppBskyRichtextFacet from './types/app/bsky/richtext/facet'
export * as AppBskyUnspeccedDefs from './types/app/bsky/unspecced/defs'
export * as AppBskyUnspeccedGetConfig from './types/app/bsky/unspecced/getConfig'
export * as AppBskyUnspeccedGetPopularFeedGenerators from './types/app/bsky/unspecced/getPopularFeedGenerators'
export * as AppBskyUnspeccedGetSuggestionsSkeleton from './types/app/bsky/unspecced/getSuggestionsSkeleton'
export * as AppBskyUnspeccedGetTaggedSuggestions from './types/app/bsky/unspecced/getTaggedSuggestions'
export * as AppBskyUnspeccedGetTrendingTopics from './types/app/bsky/unspecced/getTrendingTopics'
export * as AppBskyUnspeccedSearchActorsSkeleton from './types/app/bsky/unspecced/searchActorsSkeleton'
export * as AppBskyUnspeccedSearchPostsSkeleton from './types/app/bsky/unspecced/searchPostsSkeleton'
export * as AppBskyUnspeccedSearchStarterPacksSkeleton from './types/app/bsky/unspecced/searchStarterPacksSkeleton'
export * as AppBskyVideoDefs from './types/app/bsky/video/defs'
export * as AppBskyVideoGetJobStatus from './types/app/bsky/video/getJobStatus'
export * as AppBskyVideoGetUploadLimits from './types/app/bsky/video/getUploadLimits'
export * as AppBskyVideoUploadVideo from './types/app/bsky/video/uploadVideo'
export * as ChatBskyActorDeclaration from './types/chat/bsky/actor/declaration'
export * as ChatBskyActorDefs from './types/chat/bsky/actor/defs'
export * as ChatBskyActorDeleteAccount from './types/chat/bsky/actor/deleteAccount'
export * as ChatBskyActorExportAccountData from './types/chat/bsky/actor/exportAccountData'
export * as ChatBskyConvoDefs from './types/chat/bsky/convo/defs'
export * as ChatBskyConvoDeleteMessageForSelf from './types/chat/bsky/convo/deleteMessageForSelf'
export * as ChatBskyConvoGetConvo from './types/chat/bsky/convo/getConvo'
export * as ChatBskyConvoGetConvoForMembers from './types/chat/bsky/convo/getConvoForMembers'
export * as ChatBskyConvoGetLog from './types/chat/bsky/convo/getLog'
export * as ChatBskyConvoGetMessages from './types/chat/bsky/convo/getMessages'
export * as ChatBskyConvoLeaveConvo from './types/chat/bsky/convo/leaveConvo'
export * as ChatBskyConvoListConvos from './types/chat/bsky/convo/listConvos'
export * as ChatBskyConvoMuteConvo from './types/chat/bsky/convo/muteConvo'
export * as ChatBskyConvoSendMessage from './types/chat/bsky/convo/sendMessage'
export * as ChatBskyConvoSendMessageBatch from './types/chat/bsky/convo/sendMessageBatch'
export * as ChatBskyConvoUnmuteConvo from './types/chat/bsky/convo/unmuteConvo'
export * as ChatBskyConvoUpdateRead from './types/chat/bsky/convo/updateRead'
export * as ChatBskyModerationGetActorMetadata from './types/chat/bsky/moderation/getActorMetadata'
export * as ChatBskyModerationGetMessageContext from './types/chat/bsky/moderation/getMessageContext'
export * as ChatBskyModerationUpdateActorAccess from './types/chat/bsky/moderation/updateActorAccess'
export * as ToolsOzoneCommunicationCreateTemplate from './types/tools/ozone/communication/createTemplate'
export * as ToolsOzoneCommunicationDefs from './types/tools/ozone/communication/defs'
export * as ToolsOzoneCommunicationDeleteTemplate from './types/tools/ozone/communication/deleteTemplate'
export * as ToolsOzoneCommunicationListTemplates from './types/tools/ozone/communication/listTemplates'
export * as ToolsOzoneCommunicationUpdateTemplate from './types/tools/ozone/communication/updateTemplate'
export * as ToolsOzoneModerationDefs from './types/tools/ozone/moderation/defs'
export * as ToolsOzoneModerationEmitEvent from './types/tools/ozone/moderation/emitEvent'
export * as ToolsOzoneModerationGetEvent from './types/tools/ozone/moderation/getEvent'
export * as ToolsOzoneModerationGetRecord from './types/tools/ozone/moderation/getRecord'
export * as ToolsOzoneModerationGetRecords from './types/tools/ozone/moderation/getRecords'
export * as ToolsOzoneModerationGetRepo from './types/tools/ozone/moderation/getRepo'
export * as ToolsOzoneModerationGetRepos from './types/tools/ozone/moderation/getRepos'
export * as ToolsOzoneModerationQueryEvents from './types/tools/ozone/moderation/queryEvents'
export * as ToolsOzoneModerationQueryStatuses from './types/tools/ozone/moderation/queryStatuses'
export * as ToolsOzoneModerationSearchRepos from './types/tools/ozone/moderation/searchRepos'
export * as ToolsOzoneServerGetConfig from './types/tools/ozone/server/getConfig'
export * as ToolsOzoneSetAddValues from './types/tools/ozone/set/addValues'
export * as ToolsOzoneSetDefs from './types/tools/ozone/set/defs'
export * as ToolsOzoneSetDeleteSet from './types/tools/ozone/set/deleteSet'
export * as ToolsOzoneSetDeleteValues from './types/tools/ozone/set/deleteValues'
export * as ToolsOzoneSetGetValues from './types/tools/ozone/set/getValues'
export * as ToolsOzoneSetQuerySets from './types/tools/ozone/set/querySets'
export * as ToolsOzoneSetUpsertSet from './types/tools/ozone/set/upsertSet'
export * as ToolsOzoneSettingDefs from './types/tools/ozone/setting/defs'
export * as ToolsOzoneSettingListOptions from './types/tools/ozone/setting/listOptions'
export * as ToolsOzoneSettingRemoveOptions from './types/tools/ozone/setting/removeOptions'
export * as ToolsOzoneSettingUpsertOption from './types/tools/ozone/setting/upsertOption'
export * as ToolsOzoneSignatureDefs from './types/tools/ozone/signature/defs'
export * as ToolsOzoneSignatureFindCorrelation from './types/tools/ozone/signature/findCorrelation'
export * as ToolsOzoneSignatureFindRelatedAccounts from './types/tools/ozone/signature/findRelatedAccounts'
export * as ToolsOzoneSignatureSearchAccounts from './types/tools/ozone/signature/searchAccounts'
export * as ToolsOzoneTeamAddMember from './types/tools/ozone/team/addMember'
export * as ToolsOzoneTeamDefs from './types/tools/ozone/team/defs'
export * as ToolsOzoneTeamDeleteMember from './types/tools/ozone/team/deleteMember'
export * as ToolsOzoneTeamListMembers from './types/tools/ozone/team/listMembers'
export * as ToolsOzoneTeamUpdateMember from './types/tools/ozone/team/updateMember'

export const COM_ATPROTO_MODERATION = {
  DefsReasonSpam: 'com.atproto.moderation.defs#reasonSpam',
  DefsReasonViolation: 'com.atproto.moderation.defs#reasonViolation',
  DefsReasonMisleading: 'com.atproto.moderation.defs#reasonMisleading',
  DefsReasonSexual: 'com.atproto.moderation.defs#reasonSexual',
  DefsReasonRude: 'com.atproto.moderation.defs#reasonRude',
  DefsReasonOther: 'com.atproto.moderation.defs#reasonOther',
  DefsReasonAppeal: 'com.atproto.moderation.defs#reasonAppeal',
}
export const APP_BSKY_FEED = {
  DefsRequestLess: 'app.bsky.feed.defs#requestLess',
  DefsRequestMore: 'app.bsky.feed.defs#requestMore',
  DefsClickthroughItem: 'app.bsky.feed.defs#clickthroughItem',
  DefsClickthroughAuthor: 'app.bsky.feed.defs#clickthroughAuthor',
  DefsClickthroughReposter: 'app.bsky.feed.defs#clickthroughReposter',
  DefsClickthroughEmbed: 'app.bsky.feed.defs#clickthroughEmbed',
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
}
export const TOOLS_OZONE_TEAM = {
  DefsRoleAdmin: 'tools.ozone.team.defs#roleAdmin',
  DefsRoleModerator: 'tools.ozone.team.defs#roleModerator',
  DefsRoleTriage: 'tools.ozone.team.defs#roleTriage',
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

  resolveHandle(
    params?: ComAtprotoIdentityResolveHandle.QueryParams,
    opts?: ComAtprotoIdentityResolveHandle.CallOptions,
  ): Promise<ComAtprotoIdentityResolveHandle.Response> {
    return this._client.call(
      'com.atproto.identity.resolveHandle',
      params,
      undefined,
      opts,
    )
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
    return this._client.call(
      'com.atproto.sync.requestCrawl',
      opts?.qp,
      data,
      opts,
    )
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
  profile: ProfileRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.profile = new ProfileRecord(client)
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

export class ProfileRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyActorProfile.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.actor.profile',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyActorProfile.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.actor.profile'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.actor.profile', rkey: 'self', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class AppBskyEmbedNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }
}

export class AppBskyFeedNS {
  _client: XrpcClient
  generator: GeneratorRecord
  like: LikeRecord
  post: PostRecord
  postgate: PostgateRecord
  repost: RepostRecord
  threadgate: ThreadgateRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.generator = new GeneratorRecord(client)
    this.like = new LikeRecord(client)
    this.post = new PostRecord(client)
    this.postgate = new PostgateRecord(client)
    this.repost = new RepostRecord(client)
    this.threadgate = new ThreadgateRecord(client)
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

export class GeneratorRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedGenerator.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.generator',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedGenerator.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.generator'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.generator', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class LikeRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedLike.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.like',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedLike.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.like'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.like', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class PostRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedPost.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.post',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedPost.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.post'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.post', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class PostgateRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedPostgate.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.postgate',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedPostgate.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.postgate'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.postgate', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class RepostRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedRepost.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.repost',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedRepost.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.repost'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.repost', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class ThreadgateRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedThreadgate.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.threadgate'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.threadgate', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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
  block: BlockRecord
  follow: FollowRecord
  list: ListRecord
  listblock: ListblockRecord
  listitem: ListitemRecord
  starterpack: StarterpackRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.block = new BlockRecord(client)
    this.follow = new FollowRecord(client)
    this.list = new ListRecord(client)
    this.listblock = new ListblockRecord(client)
    this.listitem = new ListitemRecord(client)
    this.starterpack = new StarterpackRecord(client)
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

export class BlockRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphBlock.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.block',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphBlock.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.block'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.block', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class FollowRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphFollow.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.follow',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphFollow.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.follow'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.follow', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class ListRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphList.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.list',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphList.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.list'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.list', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class ListblockRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphListblock.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.listblock'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.listblock', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class ListitemRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphListitem.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.listitem',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphListitem.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.listitem'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.listitem', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class StarterpackRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphStarterpack.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.starterpack'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.starterpack', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

export class AppBskyLabelerNS {
  _client: XrpcClient
  service: ServiceRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.service = new ServiceRecord(client)
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

export class ServiceRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyLabelerService.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.labeler.service'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection: 'app.bsky.labeler.service',
        rkey: 'self',
        ...params,
        record,
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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

  constructor(client: XrpcClient) {
    this._client = client
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
  declaration: DeclarationRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.declaration = new DeclarationRecord(client)
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

export class DeclarationRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
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
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: ChatBskyActorDeclaration.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'chat.bsky.actor.declaration'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection: 'chat.bsky.actor.declaration',
        rkey: 'self',
        ...params,
        record,
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
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
  moderation: ToolsOzoneModerationNS
  server: ToolsOzoneServerNS
  set: ToolsOzoneSetNS
  setting: ToolsOzoneSettingNS
  signature: ToolsOzoneSignatureNS
  team: ToolsOzoneTeamNS

  constructor(client: XrpcClient) {
    this._client = client
    this.communication = new ToolsOzoneCommunicationNS(client)
    this.moderation = new ToolsOzoneModerationNS(client)
    this.server = new ToolsOzoneServerNS(client)
    this.set = new ToolsOzoneSetNS(client)
    this.setting = new ToolsOzoneSettingNS(client)
    this.signature = new ToolsOzoneSignatureNS(client)
    this.team = new ToolsOzoneTeamNS(client)
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

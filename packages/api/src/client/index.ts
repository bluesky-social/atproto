/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  Client as XrpcClient,
  ServiceClient as XrpcServiceClient,
} from '@atproto/xrpc'
import { schemas } from './lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from './types/com/atproto/admin/defs'
import * as ComAtprotoAdminDeleteAccount from './types/com/atproto/admin/deleteAccount'
import * as ComAtprotoAdminDisableAccountInvites from './types/com/atproto/admin/disableAccountInvites'
import * as ComAtprotoAdminDisableInviteCodes from './types/com/atproto/admin/disableInviteCodes'
import * as ComAtprotoAdminEmitModerationEvent from './types/com/atproto/admin/emitModerationEvent'
import * as ComAtprotoAdminEnableAccountInvites from './types/com/atproto/admin/enableAccountInvites'
import * as ComAtprotoAdminGetAccountInfo from './types/com/atproto/admin/getAccountInfo'
import * as ComAtprotoAdminGetInviteCodes from './types/com/atproto/admin/getInviteCodes'
import * as ComAtprotoAdminGetModerationEvent from './types/com/atproto/admin/getModerationEvent'
import * as ComAtprotoAdminGetRecord from './types/com/atproto/admin/getRecord'
import * as ComAtprotoAdminGetRepo from './types/com/atproto/admin/getRepo'
import * as ComAtprotoAdminGetSubjectStatus from './types/com/atproto/admin/getSubjectStatus'
import * as ComAtprotoAdminQueryModerationEvents from './types/com/atproto/admin/queryModerationEvents'
import * as ComAtprotoAdminQueryModerationStatuses from './types/com/atproto/admin/queryModerationStatuses'
import * as ComAtprotoAdminSearchRepos from './types/com/atproto/admin/searchRepos'
import * as ComAtprotoAdminSendEmail from './types/com/atproto/admin/sendEmail'
import * as ComAtprotoAdminUpdateAccountEmail from './types/com/atproto/admin/updateAccountEmail'
import * as ComAtprotoAdminUpdateAccountHandle from './types/com/atproto/admin/updateAccountHandle'
import * as ComAtprotoAdminUpdateSubjectStatus from './types/com/atproto/admin/updateSubjectStatus'
import * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle'
import * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle'
import * as ComAtprotoLabelDefs from './types/com/atproto/label/defs'
import * as ComAtprotoLabelQueryLabels from './types/com/atproto/label/queryLabels'
import * as ComAtprotoLabelSubscribeLabels from './types/com/atproto/label/subscribeLabels'
import * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport'
import * as ComAtprotoModerationDefs from './types/com/atproto/moderation/defs'
import * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
import * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
import * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef'
import * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob'
import * as ComAtprotoServerConfirmEmail from './types/com/atproto/server/confirmEmail'
import * as ComAtprotoServerCreateAccount from './types/com/atproto/server/createAccount'
import * as ComAtprotoServerCreateAppPassword from './types/com/atproto/server/createAppPassword'
import * as ComAtprotoServerCreateInviteCode from './types/com/atproto/server/createInviteCode'
import * as ComAtprotoServerCreateInviteCodes from './types/com/atproto/server/createInviteCodes'
import * as ComAtprotoServerCreateSession from './types/com/atproto/server/createSession'
import * as ComAtprotoServerDefs from './types/com/atproto/server/defs'
import * as ComAtprotoServerDeleteAccount from './types/com/atproto/server/deleteAccount'
import * as ComAtprotoServerDeleteSession from './types/com/atproto/server/deleteSession'
import * as ComAtprotoServerDescribeServer from './types/com/atproto/server/describeServer'
import * as ComAtprotoServerGetAccountInviteCodes from './types/com/atproto/server/getAccountInviteCodes'
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
import * as ComAtprotoSyncListBlobs from './types/com/atproto/sync/listBlobs'
import * as ComAtprotoSyncListRepos from './types/com/atproto/sync/listRepos'
import * as ComAtprotoSyncNotifyOfUpdate from './types/com/atproto/sync/notifyOfUpdate'
import * as ComAtprotoSyncRequestCrawl from './types/com/atproto/sync/requestCrawl'
import * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos'
import * as ComAtprotoTempFetchLabels from './types/com/atproto/temp/fetchLabels'
import * as ComAtprotoTempImportRepo from './types/com/atproto/temp/importRepo'
import * as ComAtprotoTempPushBlob from './types/com/atproto/temp/pushBlob'
import * as ComAtprotoTempTransferAccount from './types/com/atproto/temp/transferAccount'
import * as AppBskyActorDefs from './types/app/bsky/actor/defs'
import * as AppBskyActorGetPreferences from './types/app/bsky/actor/getPreferences'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
import * as AppBskyActorProfile from './types/app/bsky/actor/profile'
import * as AppBskyActorPutPreferences from './types/app/bsky/actor/putPreferences'
import * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors'
import * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead'
import * as AppBskyEmbedExternal from './types/app/bsky/embed/external'
import * as AppBskyEmbedImages from './types/app/bsky/embed/images'
import * as AppBskyEmbedRecord from './types/app/bsky/embed/record'
import * as AppBskyEmbedRecordWithMedia from './types/app/bsky/embed/recordWithMedia'
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
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
import * as AppBskyFeedGetSuggestedFeeds from './types/app/bsky/feed/getSuggestedFeeds'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
import * as AppBskyFeedLike from './types/app/bsky/feed/like'
import * as AppBskyFeedPost from './types/app/bsky/feed/post'
import * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
import * as AppBskyFeedSearchPosts from './types/app/bsky/feed/searchPosts'
import * as AppBskyFeedThreadgate from './types/app/bsky/feed/threadgate'
import * as AppBskyGraphBlock from './types/app/bsky/graph/block'
import * as AppBskyGraphDefs from './types/app/bsky/graph/defs'
import * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
import * as AppBskyGraphGetBlocks from './types/app/bsky/graph/getBlocks'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyGraphGetList from './types/app/bsky/graph/getList'
import * as AppBskyGraphGetListBlocks from './types/app/bsky/graph/getListBlocks'
import * as AppBskyGraphGetListMutes from './types/app/bsky/graph/getListMutes'
import * as AppBskyGraphGetLists from './types/app/bsky/graph/getLists'
import * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
import * as AppBskyGraphGetSuggestedFollowsByActor from './types/app/bsky/graph/getSuggestedFollowsByActor'
import * as AppBskyGraphList from './types/app/bsky/graph/list'
import * as AppBskyGraphListblock from './types/app/bsky/graph/listblock'
import * as AppBskyGraphListitem from './types/app/bsky/graph/listitem'
import * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor'
import * as AppBskyGraphMuteActorList from './types/app/bsky/graph/muteActorList'
import * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor'
import * as AppBskyGraphUnmuteActorList from './types/app/bsky/graph/unmuteActorList'
import * as AppBskyNotificationGetUnreadCount from './types/app/bsky/notification/getUnreadCount'
import * as AppBskyNotificationListNotifications from './types/app/bsky/notification/listNotifications'
import * as AppBskyNotificationRegisterPush from './types/app/bsky/notification/registerPush'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
import * as AppBskyRichtextFacet from './types/app/bsky/richtext/facet'
import * as AppBskyUnspeccedDefs from './types/app/bsky/unspecced/defs'
import * as AppBskyUnspeccedGetPopular from './types/app/bsky/unspecced/getPopular'
import * as AppBskyUnspeccedGetPopularFeedGenerators from './types/app/bsky/unspecced/getPopularFeedGenerators'
import * as AppBskyUnspeccedGetTimelineSkeleton from './types/app/bsky/unspecced/getTimelineSkeleton'
import * as AppBskyUnspeccedSearchActorsSkeleton from './types/app/bsky/unspecced/searchActorsSkeleton'
import * as AppBskyUnspeccedSearchPostsSkeleton from './types/app/bsky/unspecced/searchPostsSkeleton'

export * as ComAtprotoAdminDefs from './types/com/atproto/admin/defs'
export * as ComAtprotoAdminDeleteAccount from './types/com/atproto/admin/deleteAccount'
export * as ComAtprotoAdminDisableAccountInvites from './types/com/atproto/admin/disableAccountInvites'
export * as ComAtprotoAdminDisableInviteCodes from './types/com/atproto/admin/disableInviteCodes'
export * as ComAtprotoAdminEmitModerationEvent from './types/com/atproto/admin/emitModerationEvent'
export * as ComAtprotoAdminEnableAccountInvites from './types/com/atproto/admin/enableAccountInvites'
export * as ComAtprotoAdminGetAccountInfo from './types/com/atproto/admin/getAccountInfo'
export * as ComAtprotoAdminGetInviteCodes from './types/com/atproto/admin/getInviteCodes'
export * as ComAtprotoAdminGetModerationEvent from './types/com/atproto/admin/getModerationEvent'
export * as ComAtprotoAdminGetRecord from './types/com/atproto/admin/getRecord'
export * as ComAtprotoAdminGetRepo from './types/com/atproto/admin/getRepo'
export * as ComAtprotoAdminGetSubjectStatus from './types/com/atproto/admin/getSubjectStatus'
export * as ComAtprotoAdminQueryModerationEvents from './types/com/atproto/admin/queryModerationEvents'
export * as ComAtprotoAdminQueryModerationStatuses from './types/com/atproto/admin/queryModerationStatuses'
export * as ComAtprotoAdminSearchRepos from './types/com/atproto/admin/searchRepos'
export * as ComAtprotoAdminSendEmail from './types/com/atproto/admin/sendEmail'
export * as ComAtprotoAdminUpdateAccountEmail from './types/com/atproto/admin/updateAccountEmail'
export * as ComAtprotoAdminUpdateAccountHandle from './types/com/atproto/admin/updateAccountHandle'
export * as ComAtprotoAdminUpdateSubjectStatus from './types/com/atproto/admin/updateSubjectStatus'
export * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle'
export * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle'
export * as ComAtprotoLabelDefs from './types/com/atproto/label/defs'
export * as ComAtprotoLabelQueryLabels from './types/com/atproto/label/queryLabels'
export * as ComAtprotoLabelSubscribeLabels from './types/com/atproto/label/subscribeLabels'
export * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport'
export * as ComAtprotoModerationDefs from './types/com/atproto/moderation/defs'
export * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites'
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
export * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo'
export * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
export * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
export * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef'
export * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob'
export * as ComAtprotoServerConfirmEmail from './types/com/atproto/server/confirmEmail'
export * as ComAtprotoServerCreateAccount from './types/com/atproto/server/createAccount'
export * as ComAtprotoServerCreateAppPassword from './types/com/atproto/server/createAppPassword'
export * as ComAtprotoServerCreateInviteCode from './types/com/atproto/server/createInviteCode'
export * as ComAtprotoServerCreateInviteCodes from './types/com/atproto/server/createInviteCodes'
export * as ComAtprotoServerCreateSession from './types/com/atproto/server/createSession'
export * as ComAtprotoServerDefs from './types/com/atproto/server/defs'
export * as ComAtprotoServerDeleteAccount from './types/com/atproto/server/deleteAccount'
export * as ComAtprotoServerDeleteSession from './types/com/atproto/server/deleteSession'
export * as ComAtprotoServerDescribeServer from './types/com/atproto/server/describeServer'
export * as ComAtprotoServerGetAccountInviteCodes from './types/com/atproto/server/getAccountInviteCodes'
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
export * as ComAtprotoSyncListBlobs from './types/com/atproto/sync/listBlobs'
export * as ComAtprotoSyncListRepos from './types/com/atproto/sync/listRepos'
export * as ComAtprotoSyncNotifyOfUpdate from './types/com/atproto/sync/notifyOfUpdate'
export * as ComAtprotoSyncRequestCrawl from './types/com/atproto/sync/requestCrawl'
export * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos'
export * as ComAtprotoTempFetchLabels from './types/com/atproto/temp/fetchLabels'
export * as ComAtprotoTempImportRepo from './types/com/atproto/temp/importRepo'
export * as ComAtprotoTempPushBlob from './types/com/atproto/temp/pushBlob'
export * as ComAtprotoTempTransferAccount from './types/com/atproto/temp/transferAccount'
export * as AppBskyActorDefs from './types/app/bsky/actor/defs'
export * as AppBskyActorGetPreferences from './types/app/bsky/actor/getPreferences'
export * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
export * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles'
export * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
export * as AppBskyActorProfile from './types/app/bsky/actor/profile'
export * as AppBskyActorPutPreferences from './types/app/bsky/actor/putPreferences'
export * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors'
export * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead'
export * as AppBskyEmbedExternal from './types/app/bsky/embed/external'
export * as AppBskyEmbedImages from './types/app/bsky/embed/images'
export * as AppBskyEmbedRecord from './types/app/bsky/embed/record'
export * as AppBskyEmbedRecordWithMedia from './types/app/bsky/embed/recordWithMedia'
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
export * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
export * as AppBskyFeedGetSuggestedFeeds from './types/app/bsky/feed/getSuggestedFeeds'
export * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
export * as AppBskyFeedLike from './types/app/bsky/feed/like'
export * as AppBskyFeedPost from './types/app/bsky/feed/post'
export * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
export * as AppBskyFeedSearchPosts from './types/app/bsky/feed/searchPosts'
export * as AppBskyFeedThreadgate from './types/app/bsky/feed/threadgate'
export * as AppBskyGraphBlock from './types/app/bsky/graph/block'
export * as AppBskyGraphDefs from './types/app/bsky/graph/defs'
export * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
export * as AppBskyGraphGetBlocks from './types/app/bsky/graph/getBlocks'
export * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
export * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
export * as AppBskyGraphGetList from './types/app/bsky/graph/getList'
export * as AppBskyGraphGetListBlocks from './types/app/bsky/graph/getListBlocks'
export * as AppBskyGraphGetListMutes from './types/app/bsky/graph/getListMutes'
export * as AppBskyGraphGetLists from './types/app/bsky/graph/getLists'
export * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
export * as AppBskyGraphGetSuggestedFollowsByActor from './types/app/bsky/graph/getSuggestedFollowsByActor'
export * as AppBskyGraphList from './types/app/bsky/graph/list'
export * as AppBskyGraphListblock from './types/app/bsky/graph/listblock'
export * as AppBskyGraphListitem from './types/app/bsky/graph/listitem'
export * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor'
export * as AppBskyGraphMuteActorList from './types/app/bsky/graph/muteActorList'
export * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor'
export * as AppBskyGraphUnmuteActorList from './types/app/bsky/graph/unmuteActorList'
export * as AppBskyNotificationGetUnreadCount from './types/app/bsky/notification/getUnreadCount'
export * as AppBskyNotificationListNotifications from './types/app/bsky/notification/listNotifications'
export * as AppBskyNotificationRegisterPush from './types/app/bsky/notification/registerPush'
export * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
export * as AppBskyRichtextFacet from './types/app/bsky/richtext/facet'
export * as AppBskyUnspeccedDefs from './types/app/bsky/unspecced/defs'
export * as AppBskyUnspeccedGetPopular from './types/app/bsky/unspecced/getPopular'
export * as AppBskyUnspeccedGetPopularFeedGenerators from './types/app/bsky/unspecced/getPopularFeedGenerators'
export * as AppBskyUnspeccedGetTimelineSkeleton from './types/app/bsky/unspecced/getTimelineSkeleton'
export * as AppBskyUnspeccedSearchActorsSkeleton from './types/app/bsky/unspecced/searchActorsSkeleton'
export * as AppBskyUnspeccedSearchPostsSkeleton from './types/app/bsky/unspecced/searchPostsSkeleton'

export const COM_ATPROTO_ADMIN = {
  DefsReviewOpen: 'com.atproto.admin.defs#reviewOpen',
  DefsReviewEscalated: 'com.atproto.admin.defs#reviewEscalated',
  DefsReviewClosed: 'com.atproto.admin.defs#reviewClosed',
}
export const COM_ATPROTO_MODERATION = {
  DefsReasonSpam: 'com.atproto.moderation.defs#reasonSpam',
  DefsReasonViolation: 'com.atproto.moderation.defs#reasonViolation',
  DefsReasonMisleading: 'com.atproto.moderation.defs#reasonMisleading',
  DefsReasonSexual: 'com.atproto.moderation.defs#reasonSexual',
  DefsReasonRude: 'com.atproto.moderation.defs#reasonRude',
  DefsReasonOther: 'com.atproto.moderation.defs#reasonOther',
}
export const APP_BSKY_GRAPH = {
  DefsModlist: 'app.bsky.graph.defs#modlist',
  DefsCuratelist: 'app.bsky.graph.defs#curatelist',
}

export class AtpBaseClient {
  xrpc: XrpcClient = new XrpcClient()

  constructor() {
    this.xrpc.addLexicons(schemas)
  }

  service(serviceUri: string | URL): AtpServiceClient {
    return new AtpServiceClient(this, this.xrpc.service(serviceUri))
  }
}

export class AtpServiceClient {
  _baseClient: AtpBaseClient
  xrpc: XrpcServiceClient
  com: ComNS
  app: AppNS

  constructor(baseClient: AtpBaseClient, xrpcService: XrpcServiceClient) {
    this._baseClient = baseClient
    this.xrpc = xrpcService
    this.com = new ComNS(this)
    this.app = new AppNS(this)
  }

  setHeader(key: string, value: string): void {
    this.xrpc.setHeader(key, value)
  }
}

export class ComNS {
  _service: AtpServiceClient
  atproto: AtprotoNS

  constructor(service: AtpServiceClient) {
    this._service = service
    this.atproto = new AtprotoNS(service)
  }
}

export class AtprotoNS {
  _service: AtpServiceClient
  admin: AdminNS
  identity: IdentityNS
  label: LabelNS
  moderation: ModerationNS
  repo: RepoNS
  server: ServerNS
  sync: SyncNS
  temp: TempNS

  constructor(service: AtpServiceClient) {
    this._service = service
    this.admin = new AdminNS(service)
    this.identity = new IdentityNS(service)
    this.label = new LabelNS(service)
    this.moderation = new ModerationNS(service)
    this.repo = new RepoNS(service)
    this.server = new ServerNS(service)
    this.sync = new SyncNS(service)
    this.temp = new TempNS(service)
  }
}

export class AdminNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  deleteAccount(
    data?: ComAtprotoAdminDeleteAccount.InputSchema,
    opts?: ComAtprotoAdminDeleteAccount.CallOptions,
  ): Promise<ComAtprotoAdminDeleteAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.deleteAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminDeleteAccount.toKnownErr(e)
      })
  }

  disableAccountInvites(
    data?: ComAtprotoAdminDisableAccountInvites.InputSchema,
    opts?: ComAtprotoAdminDisableAccountInvites.CallOptions,
  ): Promise<ComAtprotoAdminDisableAccountInvites.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.disableAccountInvites', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminDisableAccountInvites.toKnownErr(e)
      })
  }

  disableInviteCodes(
    data?: ComAtprotoAdminDisableInviteCodes.InputSchema,
    opts?: ComAtprotoAdminDisableInviteCodes.CallOptions,
  ): Promise<ComAtprotoAdminDisableInviteCodes.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.disableInviteCodes', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminDisableInviteCodes.toKnownErr(e)
      })
  }

  emitModerationEvent(
    data?: ComAtprotoAdminEmitModerationEvent.InputSchema,
    opts?: ComAtprotoAdminEmitModerationEvent.CallOptions,
  ): Promise<ComAtprotoAdminEmitModerationEvent.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.emitModerationEvent', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminEmitModerationEvent.toKnownErr(e)
      })
  }

  enableAccountInvites(
    data?: ComAtprotoAdminEnableAccountInvites.InputSchema,
    opts?: ComAtprotoAdminEnableAccountInvites.CallOptions,
  ): Promise<ComAtprotoAdminEnableAccountInvites.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.enableAccountInvites', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminEnableAccountInvites.toKnownErr(e)
      })
  }

  getAccountInfo(
    params?: ComAtprotoAdminGetAccountInfo.QueryParams,
    opts?: ComAtprotoAdminGetAccountInfo.CallOptions,
  ): Promise<ComAtprotoAdminGetAccountInfo.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getAccountInfo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetAccountInfo.toKnownErr(e)
      })
  }

  getInviteCodes(
    params?: ComAtprotoAdminGetInviteCodes.QueryParams,
    opts?: ComAtprotoAdminGetInviteCodes.CallOptions,
  ): Promise<ComAtprotoAdminGetInviteCodes.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getInviteCodes', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetInviteCodes.toKnownErr(e)
      })
  }

  getModerationEvent(
    params?: ComAtprotoAdminGetModerationEvent.QueryParams,
    opts?: ComAtprotoAdminGetModerationEvent.CallOptions,
  ): Promise<ComAtprotoAdminGetModerationEvent.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getModerationEvent', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetModerationEvent.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoAdminGetRecord.QueryParams,
    opts?: ComAtprotoAdminGetRecord.CallOptions,
  ): Promise<ComAtprotoAdminGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetRecord.toKnownErr(e)
      })
  }

  getRepo(
    params?: ComAtprotoAdminGetRepo.QueryParams,
    opts?: ComAtprotoAdminGetRepo.CallOptions,
  ): Promise<ComAtprotoAdminGetRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetRepo.toKnownErr(e)
      })
  }

  getSubjectStatus(
    params?: ComAtprotoAdminGetSubjectStatus.QueryParams,
    opts?: ComAtprotoAdminGetSubjectStatus.CallOptions,
  ): Promise<ComAtprotoAdminGetSubjectStatus.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getSubjectStatus', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetSubjectStatus.toKnownErr(e)
      })
  }

  queryModerationEvents(
    params?: ComAtprotoAdminQueryModerationEvents.QueryParams,
    opts?: ComAtprotoAdminQueryModerationEvents.CallOptions,
  ): Promise<ComAtprotoAdminQueryModerationEvents.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.queryModerationEvents', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminQueryModerationEvents.toKnownErr(e)
      })
  }

  queryModerationStatuses(
    params?: ComAtprotoAdminQueryModerationStatuses.QueryParams,
    opts?: ComAtprotoAdminQueryModerationStatuses.CallOptions,
  ): Promise<ComAtprotoAdminQueryModerationStatuses.Response> {
    return this._service.xrpc
      .call(
        'com.atproto.admin.queryModerationStatuses',
        params,
        undefined,
        opts,
      )
      .catch((e) => {
        throw ComAtprotoAdminQueryModerationStatuses.toKnownErr(e)
      })
  }

  searchRepos(
    params?: ComAtprotoAdminSearchRepos.QueryParams,
    opts?: ComAtprotoAdminSearchRepos.CallOptions,
  ): Promise<ComAtprotoAdminSearchRepos.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.searchRepos', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminSearchRepos.toKnownErr(e)
      })
  }

  sendEmail(
    data?: ComAtprotoAdminSendEmail.InputSchema,
    opts?: ComAtprotoAdminSendEmail.CallOptions,
  ): Promise<ComAtprotoAdminSendEmail.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.sendEmail', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminSendEmail.toKnownErr(e)
      })
  }

  updateAccountEmail(
    data?: ComAtprotoAdminUpdateAccountEmail.InputSchema,
    opts?: ComAtprotoAdminUpdateAccountEmail.CallOptions,
  ): Promise<ComAtprotoAdminUpdateAccountEmail.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.updateAccountEmail', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminUpdateAccountEmail.toKnownErr(e)
      })
  }

  updateAccountHandle(
    data?: ComAtprotoAdminUpdateAccountHandle.InputSchema,
    opts?: ComAtprotoAdminUpdateAccountHandle.CallOptions,
  ): Promise<ComAtprotoAdminUpdateAccountHandle.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.updateAccountHandle', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminUpdateAccountHandle.toKnownErr(e)
      })
  }

  updateSubjectStatus(
    data?: ComAtprotoAdminUpdateSubjectStatus.InputSchema,
    opts?: ComAtprotoAdminUpdateSubjectStatus.CallOptions,
  ): Promise<ComAtprotoAdminUpdateSubjectStatus.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.updateSubjectStatus', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminUpdateSubjectStatus.toKnownErr(e)
      })
  }
}

export class IdentityNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  resolveHandle(
    params?: ComAtprotoIdentityResolveHandle.QueryParams,
    opts?: ComAtprotoIdentityResolveHandle.CallOptions,
  ): Promise<ComAtprotoIdentityResolveHandle.Response> {
    return this._service.xrpc
      .call('com.atproto.identity.resolveHandle', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoIdentityResolveHandle.toKnownErr(e)
      })
  }

  updateHandle(
    data?: ComAtprotoIdentityUpdateHandle.InputSchema,
    opts?: ComAtprotoIdentityUpdateHandle.CallOptions,
  ): Promise<ComAtprotoIdentityUpdateHandle.Response> {
    return this._service.xrpc
      .call('com.atproto.identity.updateHandle', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoIdentityUpdateHandle.toKnownErr(e)
      })
  }
}

export class LabelNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  queryLabels(
    params?: ComAtprotoLabelQueryLabels.QueryParams,
    opts?: ComAtprotoLabelQueryLabels.CallOptions,
  ): Promise<ComAtprotoLabelQueryLabels.Response> {
    return this._service.xrpc
      .call('com.atproto.label.queryLabels', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoLabelQueryLabels.toKnownErr(e)
      })
  }
}

export class ModerationNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  createReport(
    data?: ComAtprotoModerationCreateReport.InputSchema,
    opts?: ComAtprotoModerationCreateReport.CallOptions,
  ): Promise<ComAtprotoModerationCreateReport.Response> {
    return this._service.xrpc
      .call('com.atproto.moderation.createReport', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoModerationCreateReport.toKnownErr(e)
      })
  }
}

export class RepoNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  applyWrites(
    data?: ComAtprotoRepoApplyWrites.InputSchema,
    opts?: ComAtprotoRepoApplyWrites.CallOptions,
  ): Promise<ComAtprotoRepoApplyWrites.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.applyWrites', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoApplyWrites.toKnownErr(e)
      })
  }

  createRecord(
    data?: ComAtprotoRepoCreateRecord.InputSchema,
    opts?: ComAtprotoRepoCreateRecord.CallOptions,
  ): Promise<ComAtprotoRepoCreateRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.createRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoCreateRecord.toKnownErr(e)
      })
  }

  deleteRecord(
    data?: ComAtprotoRepoDeleteRecord.InputSchema,
    opts?: ComAtprotoRepoDeleteRecord.CallOptions,
  ): Promise<ComAtprotoRepoDeleteRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.deleteRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoDeleteRecord.toKnownErr(e)
      })
  }

  describeRepo(
    params?: ComAtprotoRepoDescribeRepo.QueryParams,
    opts?: ComAtprotoRepoDescribeRepo.CallOptions,
  ): Promise<ComAtprotoRepoDescribeRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.describeRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoDescribeRepo.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoRepoGetRecord.QueryParams,
    opts?: ComAtprotoRepoGetRecord.CallOptions,
  ): Promise<ComAtprotoRepoGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoGetRecord.toKnownErr(e)
      })
  }

  listRecords(
    params?: ComAtprotoRepoListRecords.QueryParams,
    opts?: ComAtprotoRepoListRecords.CallOptions,
  ): Promise<ComAtprotoRepoListRecords.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.listRecords', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoListRecords.toKnownErr(e)
      })
  }

  putRecord(
    data?: ComAtprotoRepoPutRecord.InputSchema,
    opts?: ComAtprotoRepoPutRecord.CallOptions,
  ): Promise<ComAtprotoRepoPutRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.putRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoPutRecord.toKnownErr(e)
      })
  }

  uploadBlob(
    data?: ComAtprotoRepoUploadBlob.InputSchema,
    opts?: ComAtprotoRepoUploadBlob.CallOptions,
  ): Promise<ComAtprotoRepoUploadBlob.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.uploadBlob', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoUploadBlob.toKnownErr(e)
      })
  }
}

export class ServerNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  confirmEmail(
    data?: ComAtprotoServerConfirmEmail.InputSchema,
    opts?: ComAtprotoServerConfirmEmail.CallOptions,
  ): Promise<ComAtprotoServerConfirmEmail.Response> {
    return this._service.xrpc
      .call('com.atproto.server.confirmEmail', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerConfirmEmail.toKnownErr(e)
      })
  }

  createAccount(
    data?: ComAtprotoServerCreateAccount.InputSchema,
    opts?: ComAtprotoServerCreateAccount.CallOptions,
  ): Promise<ComAtprotoServerCreateAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.server.createAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateAccount.toKnownErr(e)
      })
  }

  createAppPassword(
    data?: ComAtprotoServerCreateAppPassword.InputSchema,
    opts?: ComAtprotoServerCreateAppPassword.CallOptions,
  ): Promise<ComAtprotoServerCreateAppPassword.Response> {
    return this._service.xrpc
      .call('com.atproto.server.createAppPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateAppPassword.toKnownErr(e)
      })
  }

  createInviteCode(
    data?: ComAtprotoServerCreateInviteCode.InputSchema,
    opts?: ComAtprotoServerCreateInviteCode.CallOptions,
  ): Promise<ComAtprotoServerCreateInviteCode.Response> {
    return this._service.xrpc
      .call('com.atproto.server.createInviteCode', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateInviteCode.toKnownErr(e)
      })
  }

  createInviteCodes(
    data?: ComAtprotoServerCreateInviteCodes.InputSchema,
    opts?: ComAtprotoServerCreateInviteCodes.CallOptions,
  ): Promise<ComAtprotoServerCreateInviteCodes.Response> {
    return this._service.xrpc
      .call('com.atproto.server.createInviteCodes', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateInviteCodes.toKnownErr(e)
      })
  }

  createSession(
    data?: ComAtprotoServerCreateSession.InputSchema,
    opts?: ComAtprotoServerCreateSession.CallOptions,
  ): Promise<ComAtprotoServerCreateSession.Response> {
    return this._service.xrpc
      .call('com.atproto.server.createSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerCreateSession.toKnownErr(e)
      })
  }

  deleteAccount(
    data?: ComAtprotoServerDeleteAccount.InputSchema,
    opts?: ComAtprotoServerDeleteAccount.CallOptions,
  ): Promise<ComAtprotoServerDeleteAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.server.deleteAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerDeleteAccount.toKnownErr(e)
      })
  }

  deleteSession(
    data?: ComAtprotoServerDeleteSession.InputSchema,
    opts?: ComAtprotoServerDeleteSession.CallOptions,
  ): Promise<ComAtprotoServerDeleteSession.Response> {
    return this._service.xrpc
      .call('com.atproto.server.deleteSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerDeleteSession.toKnownErr(e)
      })
  }

  describeServer(
    params?: ComAtprotoServerDescribeServer.QueryParams,
    opts?: ComAtprotoServerDescribeServer.CallOptions,
  ): Promise<ComAtprotoServerDescribeServer.Response> {
    return this._service.xrpc
      .call('com.atproto.server.describeServer', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerDescribeServer.toKnownErr(e)
      })
  }

  getAccountInviteCodes(
    params?: ComAtprotoServerGetAccountInviteCodes.QueryParams,
    opts?: ComAtprotoServerGetAccountInviteCodes.CallOptions,
  ): Promise<ComAtprotoServerGetAccountInviteCodes.Response> {
    return this._service.xrpc
      .call('com.atproto.server.getAccountInviteCodes', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerGetAccountInviteCodes.toKnownErr(e)
      })
  }

  getSession(
    params?: ComAtprotoServerGetSession.QueryParams,
    opts?: ComAtprotoServerGetSession.CallOptions,
  ): Promise<ComAtprotoServerGetSession.Response> {
    return this._service.xrpc
      .call('com.atproto.server.getSession', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerGetSession.toKnownErr(e)
      })
  }

  listAppPasswords(
    params?: ComAtprotoServerListAppPasswords.QueryParams,
    opts?: ComAtprotoServerListAppPasswords.CallOptions,
  ): Promise<ComAtprotoServerListAppPasswords.Response> {
    return this._service.xrpc
      .call('com.atproto.server.listAppPasswords', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerListAppPasswords.toKnownErr(e)
      })
  }

  refreshSession(
    data?: ComAtprotoServerRefreshSession.InputSchema,
    opts?: ComAtprotoServerRefreshSession.CallOptions,
  ): Promise<ComAtprotoServerRefreshSession.Response> {
    return this._service.xrpc
      .call('com.atproto.server.refreshSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerRefreshSession.toKnownErr(e)
      })
  }

  requestAccountDelete(
    data?: ComAtprotoServerRequestAccountDelete.InputSchema,
    opts?: ComAtprotoServerRequestAccountDelete.CallOptions,
  ): Promise<ComAtprotoServerRequestAccountDelete.Response> {
    return this._service.xrpc
      .call('com.atproto.server.requestAccountDelete', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerRequestAccountDelete.toKnownErr(e)
      })
  }

  requestEmailConfirmation(
    data?: ComAtprotoServerRequestEmailConfirmation.InputSchema,
    opts?: ComAtprotoServerRequestEmailConfirmation.CallOptions,
  ): Promise<ComAtprotoServerRequestEmailConfirmation.Response> {
    return this._service.xrpc
      .call('com.atproto.server.requestEmailConfirmation', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerRequestEmailConfirmation.toKnownErr(e)
      })
  }

  requestEmailUpdate(
    data?: ComAtprotoServerRequestEmailUpdate.InputSchema,
    opts?: ComAtprotoServerRequestEmailUpdate.CallOptions,
  ): Promise<ComAtprotoServerRequestEmailUpdate.Response> {
    return this._service.xrpc
      .call('com.atproto.server.requestEmailUpdate', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerRequestEmailUpdate.toKnownErr(e)
      })
  }

  requestPasswordReset(
    data?: ComAtprotoServerRequestPasswordReset.InputSchema,
    opts?: ComAtprotoServerRequestPasswordReset.CallOptions,
  ): Promise<ComAtprotoServerRequestPasswordReset.Response> {
    return this._service.xrpc
      .call('com.atproto.server.requestPasswordReset', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerRequestPasswordReset.toKnownErr(e)
      })
  }

  reserveSigningKey(
    data?: ComAtprotoServerReserveSigningKey.InputSchema,
    opts?: ComAtprotoServerReserveSigningKey.CallOptions,
  ): Promise<ComAtprotoServerReserveSigningKey.Response> {
    return this._service.xrpc
      .call('com.atproto.server.reserveSigningKey', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerReserveSigningKey.toKnownErr(e)
      })
  }

  resetPassword(
    data?: ComAtprotoServerResetPassword.InputSchema,
    opts?: ComAtprotoServerResetPassword.CallOptions,
  ): Promise<ComAtprotoServerResetPassword.Response> {
    return this._service.xrpc
      .call('com.atproto.server.resetPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerResetPassword.toKnownErr(e)
      })
  }

  revokeAppPassword(
    data?: ComAtprotoServerRevokeAppPassword.InputSchema,
    opts?: ComAtprotoServerRevokeAppPassword.CallOptions,
  ): Promise<ComAtprotoServerRevokeAppPassword.Response> {
    return this._service.xrpc
      .call('com.atproto.server.revokeAppPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerRevokeAppPassword.toKnownErr(e)
      })
  }

  updateEmail(
    data?: ComAtprotoServerUpdateEmail.InputSchema,
    opts?: ComAtprotoServerUpdateEmail.CallOptions,
  ): Promise<ComAtprotoServerUpdateEmail.Response> {
    return this._service.xrpc
      .call('com.atproto.server.updateEmail', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoServerUpdateEmail.toKnownErr(e)
      })
  }
}

export class SyncNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  getBlob(
    params?: ComAtprotoSyncGetBlob.QueryParams,
    opts?: ComAtprotoSyncGetBlob.CallOptions,
  ): Promise<ComAtprotoSyncGetBlob.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getBlob', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetBlob.toKnownErr(e)
      })
  }

  getBlocks(
    params?: ComAtprotoSyncGetBlocks.QueryParams,
    opts?: ComAtprotoSyncGetBlocks.CallOptions,
  ): Promise<ComAtprotoSyncGetBlocks.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getBlocks', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetBlocks.toKnownErr(e)
      })
  }

  getCheckout(
    params?: ComAtprotoSyncGetCheckout.QueryParams,
    opts?: ComAtprotoSyncGetCheckout.CallOptions,
  ): Promise<ComAtprotoSyncGetCheckout.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getCheckout', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetCheckout.toKnownErr(e)
      })
  }

  getHead(
    params?: ComAtprotoSyncGetHead.QueryParams,
    opts?: ComAtprotoSyncGetHead.CallOptions,
  ): Promise<ComAtprotoSyncGetHead.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getHead', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetHead.toKnownErr(e)
      })
  }

  getLatestCommit(
    params?: ComAtprotoSyncGetLatestCommit.QueryParams,
    opts?: ComAtprotoSyncGetLatestCommit.CallOptions,
  ): Promise<ComAtprotoSyncGetLatestCommit.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getLatestCommit', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetLatestCommit.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoSyncGetRecord.QueryParams,
    opts?: ComAtprotoSyncGetRecord.CallOptions,
  ): Promise<ComAtprotoSyncGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRecord.toKnownErr(e)
      })
  }

  getRepo(
    params?: ComAtprotoSyncGetRepo.QueryParams,
    opts?: ComAtprotoSyncGetRepo.CallOptions,
  ): Promise<ComAtprotoSyncGetRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRepo.toKnownErr(e)
      })
  }

  listBlobs(
    params?: ComAtprotoSyncListBlobs.QueryParams,
    opts?: ComAtprotoSyncListBlobs.CallOptions,
  ): Promise<ComAtprotoSyncListBlobs.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.listBlobs', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncListBlobs.toKnownErr(e)
      })
  }

  listRepos(
    params?: ComAtprotoSyncListRepos.QueryParams,
    opts?: ComAtprotoSyncListRepos.CallOptions,
  ): Promise<ComAtprotoSyncListRepos.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.listRepos', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncListRepos.toKnownErr(e)
      })
  }

  notifyOfUpdate(
    data?: ComAtprotoSyncNotifyOfUpdate.InputSchema,
    opts?: ComAtprotoSyncNotifyOfUpdate.CallOptions,
  ): Promise<ComAtprotoSyncNotifyOfUpdate.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.notifyOfUpdate', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSyncNotifyOfUpdate.toKnownErr(e)
      })
  }

  requestCrawl(
    data?: ComAtprotoSyncRequestCrawl.InputSchema,
    opts?: ComAtprotoSyncRequestCrawl.CallOptions,
  ): Promise<ComAtprotoSyncRequestCrawl.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.requestCrawl', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSyncRequestCrawl.toKnownErr(e)
      })
  }
}

export class TempNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  fetchLabels(
    params?: ComAtprotoTempFetchLabels.QueryParams,
    opts?: ComAtprotoTempFetchLabels.CallOptions,
  ): Promise<ComAtprotoTempFetchLabels.Response> {
    return this._service.xrpc
      .call('com.atproto.temp.fetchLabels', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoTempFetchLabels.toKnownErr(e)
      })
  }

  importRepo(
    data?: ComAtprotoTempImportRepo.InputSchema,
    opts?: ComAtprotoTempImportRepo.CallOptions,
  ): Promise<ComAtprotoTempImportRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.temp.importRepo', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoTempImportRepo.toKnownErr(e)
      })
  }

  pushBlob(
    data?: ComAtprotoTempPushBlob.InputSchema,
    opts?: ComAtprotoTempPushBlob.CallOptions,
  ): Promise<ComAtprotoTempPushBlob.Response> {
    return this._service.xrpc
      .call('com.atproto.temp.pushBlob', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoTempPushBlob.toKnownErr(e)
      })
  }

  transferAccount(
    data?: ComAtprotoTempTransferAccount.InputSchema,
    opts?: ComAtprotoTempTransferAccount.CallOptions,
  ): Promise<ComAtprotoTempTransferAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.temp.transferAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoTempTransferAccount.toKnownErr(e)
      })
  }
}

export class AppNS {
  _service: AtpServiceClient
  bsky: BskyNS

  constructor(service: AtpServiceClient) {
    this._service = service
    this.bsky = new BskyNS(service)
  }
}

export class BskyNS {
  _service: AtpServiceClient
  actor: ActorNS
  embed: EmbedNS
  feed: FeedNS
  graph: GraphNS
  notification: NotificationNS
  richtext: RichtextNS
  unspecced: UnspeccedNS

  constructor(service: AtpServiceClient) {
    this._service = service
    this.actor = new ActorNS(service)
    this.embed = new EmbedNS(service)
    this.feed = new FeedNS(service)
    this.graph = new GraphNS(service)
    this.notification = new NotificationNS(service)
    this.richtext = new RichtextNS(service)
    this.unspecced = new UnspeccedNS(service)
  }
}

export class ActorNS {
  _service: AtpServiceClient
  profile: ProfileRecord

  constructor(service: AtpServiceClient) {
    this._service = service
    this.profile = new ProfileRecord(service)
  }

  getPreferences(
    params?: AppBskyActorGetPreferences.QueryParams,
    opts?: AppBskyActorGetPreferences.CallOptions,
  ): Promise<AppBskyActorGetPreferences.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getPreferences', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetPreferences.toKnownErr(e)
      })
  }

  getProfile(
    params?: AppBskyActorGetProfile.QueryParams,
    opts?: AppBskyActorGetProfile.CallOptions,
  ): Promise<AppBskyActorGetProfile.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getProfile', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetProfile.toKnownErr(e)
      })
  }

  getProfiles(
    params?: AppBskyActorGetProfiles.QueryParams,
    opts?: AppBskyActorGetProfiles.CallOptions,
  ): Promise<AppBskyActorGetProfiles.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getProfiles', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetProfiles.toKnownErr(e)
      })
  }

  getSuggestions(
    params?: AppBskyActorGetSuggestions.QueryParams,
    opts?: AppBskyActorGetSuggestions.CallOptions,
  ): Promise<AppBskyActorGetSuggestions.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getSuggestions', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetSuggestions.toKnownErr(e)
      })
  }

  putPreferences(
    data?: AppBskyActorPutPreferences.InputSchema,
    opts?: AppBskyActorPutPreferences.CallOptions,
  ): Promise<AppBskyActorPutPreferences.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.putPreferences', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyActorPutPreferences.toKnownErr(e)
      })
  }

  searchActors(
    params?: AppBskyActorSearchActors.QueryParams,
    opts?: AppBskyActorSearchActors.CallOptions,
  ): Promise<AppBskyActorSearchActors.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.searchActors', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorSearchActors.toKnownErr(e)
      })
  }

  searchActorsTypeahead(
    params?: AppBskyActorSearchActorsTypeahead.QueryParams,
    opts?: AppBskyActorSearchActorsTypeahead.CallOptions,
  ): Promise<AppBskyActorSearchActorsTypeahead.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.searchActorsTypeahead', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorSearchActorsTypeahead.toKnownErr(e)
      })
  }
}

export class ProfileRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyActorProfile.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.actor.profile',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyActorProfile.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.actor.profile', ...params },
      { headers },
    )
  }
}

export class EmbedNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }
}

export class FeedNS {
  _service: AtpServiceClient
  generator: GeneratorRecord
  like: LikeRecord
  post: PostRecord
  repost: RepostRecord
  threadgate: ThreadgateRecord

  constructor(service: AtpServiceClient) {
    this._service = service
    this.generator = new GeneratorRecord(service)
    this.like = new LikeRecord(service)
    this.post = new PostRecord(service)
    this.repost = new RepostRecord(service)
    this.threadgate = new ThreadgateRecord(service)
  }

  describeFeedGenerator(
    params?: AppBskyFeedDescribeFeedGenerator.QueryParams,
    opts?: AppBskyFeedDescribeFeedGenerator.CallOptions,
  ): Promise<AppBskyFeedDescribeFeedGenerator.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.describeFeedGenerator', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedDescribeFeedGenerator.toKnownErr(e)
      })
  }

  getActorFeeds(
    params?: AppBskyFeedGetActorFeeds.QueryParams,
    opts?: AppBskyFeedGetActorFeeds.CallOptions,
  ): Promise<AppBskyFeedGetActorFeeds.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getActorFeeds', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetActorFeeds.toKnownErr(e)
      })
  }

  getActorLikes(
    params?: AppBskyFeedGetActorLikes.QueryParams,
    opts?: AppBskyFeedGetActorLikes.CallOptions,
  ): Promise<AppBskyFeedGetActorLikes.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getActorLikes', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetActorLikes.toKnownErr(e)
      })
  }

  getAuthorFeed(
    params?: AppBskyFeedGetAuthorFeed.QueryParams,
    opts?: AppBskyFeedGetAuthorFeed.CallOptions,
  ): Promise<AppBskyFeedGetAuthorFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getAuthorFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetAuthorFeed.toKnownErr(e)
      })
  }

  getFeed(
    params?: AppBskyFeedGetFeed.QueryParams,
    opts?: AppBskyFeedGetFeed.CallOptions,
  ): Promise<AppBskyFeedGetFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetFeed.toKnownErr(e)
      })
  }

  getFeedGenerator(
    params?: AppBskyFeedGetFeedGenerator.QueryParams,
    opts?: AppBskyFeedGetFeedGenerator.CallOptions,
  ): Promise<AppBskyFeedGetFeedGenerator.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getFeedGenerator', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetFeedGenerator.toKnownErr(e)
      })
  }

  getFeedGenerators(
    params?: AppBskyFeedGetFeedGenerators.QueryParams,
    opts?: AppBskyFeedGetFeedGenerators.CallOptions,
  ): Promise<AppBskyFeedGetFeedGenerators.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getFeedGenerators', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetFeedGenerators.toKnownErr(e)
      })
  }

  getFeedSkeleton(
    params?: AppBskyFeedGetFeedSkeleton.QueryParams,
    opts?: AppBskyFeedGetFeedSkeleton.CallOptions,
  ): Promise<AppBskyFeedGetFeedSkeleton.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getFeedSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetFeedSkeleton.toKnownErr(e)
      })
  }

  getLikes(
    params?: AppBskyFeedGetLikes.QueryParams,
    opts?: AppBskyFeedGetLikes.CallOptions,
  ): Promise<AppBskyFeedGetLikes.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getLikes', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetLikes.toKnownErr(e)
      })
  }

  getListFeed(
    params?: AppBskyFeedGetListFeed.QueryParams,
    opts?: AppBskyFeedGetListFeed.CallOptions,
  ): Promise<AppBskyFeedGetListFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getListFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetListFeed.toKnownErr(e)
      })
  }

  getPostThread(
    params?: AppBskyFeedGetPostThread.QueryParams,
    opts?: AppBskyFeedGetPostThread.CallOptions,
  ): Promise<AppBskyFeedGetPostThread.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getPostThread', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetPostThread.toKnownErr(e)
      })
  }

  getPosts(
    params?: AppBskyFeedGetPosts.QueryParams,
    opts?: AppBskyFeedGetPosts.CallOptions,
  ): Promise<AppBskyFeedGetPosts.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getPosts', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetPosts.toKnownErr(e)
      })
  }

  getRepostedBy(
    params?: AppBskyFeedGetRepostedBy.QueryParams,
    opts?: AppBskyFeedGetRepostedBy.CallOptions,
  ): Promise<AppBskyFeedGetRepostedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getRepostedBy', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetRepostedBy.toKnownErr(e)
      })
  }

  getSuggestedFeeds(
    params?: AppBskyFeedGetSuggestedFeeds.QueryParams,
    opts?: AppBskyFeedGetSuggestedFeeds.CallOptions,
  ): Promise<AppBskyFeedGetSuggestedFeeds.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getSuggestedFeeds', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetSuggestedFeeds.toKnownErr(e)
      })
  }

  getTimeline(
    params?: AppBskyFeedGetTimeline.QueryParams,
    opts?: AppBskyFeedGetTimeline.CallOptions,
  ): Promise<AppBskyFeedGetTimeline.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getTimeline', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetTimeline.toKnownErr(e)
      })
  }

  searchPosts(
    params?: AppBskyFeedSearchPosts.QueryParams,
    opts?: AppBskyFeedSearchPosts.CallOptions,
  ): Promise<AppBskyFeedSearchPosts.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.searchPosts', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedSearchPosts.toKnownErr(e)
      })
  }
}

export class GeneratorRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedGenerator.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.generator',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedGenerator.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.generator', ...params },
      { headers },
    )
  }
}

export class LikeRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedLike.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.like',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedLike.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.like', ...params },
      { headers },
    )
  }
}

export class PostRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedPost.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.post',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedPost.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.post', ...params },
      { headers },
    )
  }
}

export class RepostRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedRepost.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.repost',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedRepost.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.repost', ...params },
      { headers },
    )
  }
}

export class ThreadgateRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedThreadgate.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
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
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.threadgate', ...params },
      { headers },
    )
  }
}

export class GraphNS {
  _service: AtpServiceClient
  block: BlockRecord
  follow: FollowRecord
  list: ListRecord
  listblock: ListblockRecord
  listitem: ListitemRecord

  constructor(service: AtpServiceClient) {
    this._service = service
    this.block = new BlockRecord(service)
    this.follow = new FollowRecord(service)
    this.list = new ListRecord(service)
    this.listblock = new ListblockRecord(service)
    this.listitem = new ListitemRecord(service)
  }

  getBlocks(
    params?: AppBskyGraphGetBlocks.QueryParams,
    opts?: AppBskyGraphGetBlocks.CallOptions,
  ): Promise<AppBskyGraphGetBlocks.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getBlocks', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetBlocks.toKnownErr(e)
      })
  }

  getFollowers(
    params?: AppBskyGraphGetFollowers.QueryParams,
    opts?: AppBskyGraphGetFollowers.CallOptions,
  ): Promise<AppBskyGraphGetFollowers.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getFollowers', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetFollowers.toKnownErr(e)
      })
  }

  getFollows(
    params?: AppBskyGraphGetFollows.QueryParams,
    opts?: AppBskyGraphGetFollows.CallOptions,
  ): Promise<AppBskyGraphGetFollows.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getFollows', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetFollows.toKnownErr(e)
      })
  }

  getList(
    params?: AppBskyGraphGetList.QueryParams,
    opts?: AppBskyGraphGetList.CallOptions,
  ): Promise<AppBskyGraphGetList.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getList', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetList.toKnownErr(e)
      })
  }

  getListBlocks(
    params?: AppBskyGraphGetListBlocks.QueryParams,
    opts?: AppBskyGraphGetListBlocks.CallOptions,
  ): Promise<AppBskyGraphGetListBlocks.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getListBlocks', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetListBlocks.toKnownErr(e)
      })
  }

  getListMutes(
    params?: AppBskyGraphGetListMutes.QueryParams,
    opts?: AppBskyGraphGetListMutes.CallOptions,
  ): Promise<AppBskyGraphGetListMutes.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getListMutes', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetListMutes.toKnownErr(e)
      })
  }

  getLists(
    params?: AppBskyGraphGetLists.QueryParams,
    opts?: AppBskyGraphGetLists.CallOptions,
  ): Promise<AppBskyGraphGetLists.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getLists', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetLists.toKnownErr(e)
      })
  }

  getMutes(
    params?: AppBskyGraphGetMutes.QueryParams,
    opts?: AppBskyGraphGetMutes.CallOptions,
  ): Promise<AppBskyGraphGetMutes.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getMutes', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetMutes.toKnownErr(e)
      })
  }

  getSuggestedFollowsByActor(
    params?: AppBskyGraphGetSuggestedFollowsByActor.QueryParams,
    opts?: AppBskyGraphGetSuggestedFollowsByActor.CallOptions,
  ): Promise<AppBskyGraphGetSuggestedFollowsByActor.Response> {
    return this._service.xrpc
      .call(
        'app.bsky.graph.getSuggestedFollowsByActor',
        params,
        undefined,
        opts,
      )
      .catch((e) => {
        throw AppBskyGraphGetSuggestedFollowsByActor.toKnownErr(e)
      })
  }

  muteActor(
    data?: AppBskyGraphMuteActor.InputSchema,
    opts?: AppBskyGraphMuteActor.CallOptions,
  ): Promise<AppBskyGraphMuteActor.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.muteActor', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyGraphMuteActor.toKnownErr(e)
      })
  }

  muteActorList(
    data?: AppBskyGraphMuteActorList.InputSchema,
    opts?: AppBskyGraphMuteActorList.CallOptions,
  ): Promise<AppBskyGraphMuteActorList.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.muteActorList', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyGraphMuteActorList.toKnownErr(e)
      })
  }

  unmuteActor(
    data?: AppBskyGraphUnmuteActor.InputSchema,
    opts?: AppBskyGraphUnmuteActor.CallOptions,
  ): Promise<AppBskyGraphUnmuteActor.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.unmuteActor', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyGraphUnmuteActor.toKnownErr(e)
      })
  }

  unmuteActorList(
    data?: AppBskyGraphUnmuteActorList.InputSchema,
    opts?: AppBskyGraphUnmuteActorList.CallOptions,
  ): Promise<AppBskyGraphUnmuteActorList.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.unmuteActorList', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyGraphUnmuteActorList.toKnownErr(e)
      })
  }
}

export class BlockRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphBlock.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.block',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphBlock.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.block', ...params },
      { headers },
    )
  }
}

export class FollowRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphFollow.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.follow',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphFollow.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.follow', ...params },
      { headers },
    )
  }
}

export class ListRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphList.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.list',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphList.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.list', ...params },
      { headers },
    )
  }
}

export class ListblockRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphListblock.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
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
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.listblock', ...params },
      { headers },
    )
  }
}

export class ListitemRecord {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphListitem.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.listitem',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphListitem.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
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
    const res = await this._service.xrpc.call(
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
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.listitem', ...params },
      { headers },
    )
  }
}

export class NotificationNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  getUnreadCount(
    params?: AppBskyNotificationGetUnreadCount.QueryParams,
    opts?: AppBskyNotificationGetUnreadCount.CallOptions,
  ): Promise<AppBskyNotificationGetUnreadCount.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.getUnreadCount', params, undefined, opts)
      .catch((e) => {
        throw AppBskyNotificationGetUnreadCount.toKnownErr(e)
      })
  }

  listNotifications(
    params?: AppBskyNotificationListNotifications.QueryParams,
    opts?: AppBskyNotificationListNotifications.CallOptions,
  ): Promise<AppBskyNotificationListNotifications.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.listNotifications', params, undefined, opts)
      .catch((e) => {
        throw AppBskyNotificationListNotifications.toKnownErr(e)
      })
  }

  registerPush(
    data?: AppBskyNotificationRegisterPush.InputSchema,
    opts?: AppBskyNotificationRegisterPush.CallOptions,
  ): Promise<AppBskyNotificationRegisterPush.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.registerPush', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyNotificationRegisterPush.toKnownErr(e)
      })
  }

  updateSeen(
    data?: AppBskyNotificationUpdateSeen.InputSchema,
    opts?: AppBskyNotificationUpdateSeen.CallOptions,
  ): Promise<AppBskyNotificationUpdateSeen.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.updateSeen', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyNotificationUpdateSeen.toKnownErr(e)
      })
  }
}

export class RichtextNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }
}

export class UnspeccedNS {
  _service: AtpServiceClient

  constructor(service: AtpServiceClient) {
    this._service = service
  }

  getPopular(
    params?: AppBskyUnspeccedGetPopular.QueryParams,
    opts?: AppBskyUnspeccedGetPopular.CallOptions,
  ): Promise<AppBskyUnspeccedGetPopular.Response> {
    return this._service.xrpc
      .call('app.bsky.unspecced.getPopular', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedGetPopular.toKnownErr(e)
      })
  }

  getPopularFeedGenerators(
    params?: AppBskyUnspeccedGetPopularFeedGenerators.QueryParams,
    opts?: AppBskyUnspeccedGetPopularFeedGenerators.CallOptions,
  ): Promise<AppBskyUnspeccedGetPopularFeedGenerators.Response> {
    return this._service.xrpc
      .call(
        'app.bsky.unspecced.getPopularFeedGenerators',
        params,
        undefined,
        opts,
      )
      .catch((e) => {
        throw AppBskyUnspeccedGetPopularFeedGenerators.toKnownErr(e)
      })
  }

  getTimelineSkeleton(
    params?: AppBskyUnspeccedGetTimelineSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetTimelineSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetTimelineSkeleton.Response> {
    return this._service.xrpc
      .call('app.bsky.unspecced.getTimelineSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedGetTimelineSkeleton.toKnownErr(e)
      })
  }

  searchActorsSkeleton(
    params?: AppBskyUnspeccedSearchActorsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchActorsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchActorsSkeleton.Response> {
    return this._service.xrpc
      .call('app.bsky.unspecced.searchActorsSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedSearchActorsSkeleton.toKnownErr(e)
      })
  }

  searchPostsSkeleton(
    params?: AppBskyUnspeccedSearchPostsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchPostsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchPostsSkeleton.Response> {
    return this._service.xrpc
      .call('app.bsky.unspecced.searchPostsSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedSearchPostsSkeleton.toKnownErr(e)
      })
  }
}

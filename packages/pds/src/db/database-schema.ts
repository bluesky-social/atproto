import * as user from './tables/user'
import * as didHandle from './tables/did-handle'
import * as scene from './tables/scene'
import * as repoRoot from './tables/repo-root'
import * as refreshToken from './tables/refresh-token'
import * as record from './tables/record'
import * as ipldBlock from './tables/ipld-block'
import * as ipldBlockCreator from './tables/ipld-block-creator'
import * as inviteCode from './tables/invite-code'
import * as duplicateRecords from './tables/duplicate-record'
import * as notification from './tables/user-notification'
import * as assertion from './tables/assertion'
import * as profile from './tables/profile'
import * as post from './tables/post'
import * as vote from './tables/vote'
import * as repost from './tables/repost'
import * as trend from './tables/trend'
import * as follow from './tables/follow'
import * as blob from './tables/blob'
import * as repoBlob from './tables/repo-blob'
import * as messageQueue from './message-queue/tables/messageQueue'
import * as messageQueueCursor from './message-queue/tables/messageQueueCursor'
import * as sceneMemberCount from './message-queue/tables/sceneMemberCount'
import * as sceneVotesOnPost from './message-queue/tables/sceneVotesOnPost'

export type DatabaseSchema = user.PartialDB &
  didHandle.PartialDB &
  scene.PartialDB &
  refreshToken.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  ipldBlock.PartialDB &
  ipldBlockCreator.PartialDB &
  inviteCode.PartialDB &
  duplicateRecords.PartialDB &
  notification.PartialDB &
  assertion.PartialDB &
  profile.PartialDB &
  post.PartialDB &
  vote.PartialDB &
  repost.PartialDB &
  trend.PartialDB &
  follow.PartialDB &
  blob.PartialDB &
  repoBlob.PartialDB &
  messageQueue.PartialDB &
  messageQueueCursor.PartialDB &
  sceneMemberCount.PartialDB &
  sceneVotesOnPost.PartialDB

export default DatabaseSchema

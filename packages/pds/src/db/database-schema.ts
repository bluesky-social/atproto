import * as user from './tables/user'
import * as didHandle from './tables/did-handle'
import * as scene from './tables/scene'
import * as repoRoot from './tables/repo-root'
import * as refreshToken from './tables/refresh-token'
import * as record from './tables/record'
import * as ipldBlock from './tables/ipld-block'
import * as ipldBlockCreator from './tables/ipld-block-creator'
import * as inviteCode from './tables/invite-code'
import * as notification from './tables/user-notification'
import * as assertion from './tables/assertion'
import * as profile from './records/profile'
import * as post from './records/post'
import * as vote from './records/vote'
import * as repost from './records/repost'
import * as trend from './records/trend'
import * as follow from './records/follow'
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
  notification.PartialDB &
  assertion.PartialDB &
  profile.PartialDB &
  post.PartialDB &
  vote.PartialDB &
  repost.PartialDB &
  trend.PartialDB &
  follow.PartialDB &
  messageQueue.PartialDB &
  messageQueueCursor.PartialDB &
  sceneMemberCount.PartialDB &
  sceneVotesOnPost.PartialDB

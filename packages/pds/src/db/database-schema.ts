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
import * as declaration from './records/declaration'
import * as profile from './records/profile'
import * as post from './records/post'
import * as vote from './records/vote'
import * as repost from './records/repost'
import * as follow from './records/follow'
import * as assertion from './records/assertion'
import * as confirmation from './records/confirmation'

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
  declaration.PartialDB &
  profile.PartialDB &
  post.PartialDB &
  vote.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  assertion.PartialDB &
  confirmation.PartialDB

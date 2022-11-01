import * as user from './tables/user'
import * as userDid from './tables/user-did'
import * as repoRoot from './tables/repo-root'
import * as refreshToken from './tables/refresh-token'
import * as record from './tables/record'
import * as ipldBlock from './tables/ipld-block'
import * as ipldBlockCreator from './tables/ipld-block-creator'
import * as invite from './tables/invite'
import * as notification from './tables/user-notification'
import * as post from './records/post'
import * as like from './records/like'
import * as repost from './records/repost'
import * as follow from './records/follow'
import * as profile from './records/profile'

export type DatabaseSchema = user.PartialDB &
  userDid.PartialDB &
  refreshToken.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  ipldBlock.PartialDB &
  ipldBlockCreator.PartialDB &
  invite.PartialDB &
  notification.PartialDB &
  post.PartialDB &
  like.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  profile.PartialDB

import * as user from './tables/user'
import * as repoRoot from './tables/repo-root'
import * as record from './tables/record'
import * as invite from './tables/invite'
import * as notification from './tables/user-notification'
import * as post from './records/post'
import * as like from './records/like'
import * as repost from './records/repost'
import * as follow from './records/follow'
import * as profile from './records/profile'
import * as badge from './records/badge'
import * as badgeAccept from './records/badgeAccept'
import * as badgeOffer from './records/badgeOffer'

export type DatabaseSchema = user.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  invite.PartialDB &
  notification.PartialDB &
  post.PartialDB &
  like.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  profile.PartialDB &
  badge.PartialDB &
  badgeAccept.PartialDB &
  badgeOffer.PartialDB

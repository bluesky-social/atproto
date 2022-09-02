import { recordSchemas, viewSchemas } from './schemas/defs'
import { AdxSchemas } from '@adxp/schemas'
import {
  Badge,
  Follow,
  Like,
  LikedByView,
  Post,
  Profile,
  ProfileView,
  Repost,
  RepostedByView,
  UserFollowersView,
  UserFollowsView,
} from './types'

const s = new AdxSchemas()
for (const schema of recordSchemas) {
  s.add(schema)
}
for (const schema of viewSchemas) {
  s.add(schema)
}

export const postRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Post',
)
export const isPost = (obj: unknown): obj is Post.Record => {
  return postRecordValidator.isValid(obj)
}

export const likeRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Like',
)
export const isLike = (obj: unknown): obj is Like.Record => {
  return likeRecordValidator.isValid(obj)
}

export const followRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Follow',
)
export const isFollow = (obj: unknown): obj is Follow.Record => {
  return followRecordValidator.isValid(obj)
}

export const badgeRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Badge',
)
export const isBadge = (obj: unknown): obj is Badge.Record => {
  return badgeRecordValidator.isValid(obj)
}

export const repostRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Repost',
)
export const isRepost = (obj: unknown): obj is Repost.Record => {
  return repostRecordValidator.isValid(obj)
}

export const profileRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Profile',
)
export const isProfile = (obj: unknown): obj is Profile.Record => {
  return profileRecordValidator.isValid(obj)
}

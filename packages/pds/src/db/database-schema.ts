import { Kysely } from 'kysely'
import * as user from './tables/user'
import * as didHandle from './tables/did-handle'
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
import * as postEntity from './tables/post-entity'
import * as postEmbedImage from './tables/post-embed-image'
import * as postEmbedExternal from './tables/post-embed-external'
import * as vote from './tables/vote'
import * as repost from './tables/repost'
import * as follow from './tables/follow'
import * as blob from './tables/blob'
import * as repoBlob from './tables/repo-blob'
import * as messageQueue from './tables/message-queue'
import * as messageQueueCursor from './tables/message-queue-cursor'
import * as moderation from './tables/moderation'
import * as mute from './tables/mute'

export type DatabaseSchemaType = user.PartialDB &
  didHandle.PartialDB &
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
  postEntity.PartialDB &
  postEmbedImage.PartialDB &
  postEmbedExternal.PartialDB &
  vote.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  blob.PartialDB &
  repoBlob.PartialDB &
  messageQueue.PartialDB &
  messageQueueCursor.PartialDB &
  moderation.PartialDB &
  mute.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema

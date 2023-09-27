import { Kysely } from 'kysely'
import * as userAccount from './tables/user-account'
import * as userState from './tables/user-state'
import * as userPref from './tables/user-pref'
import * as didHandle from './tables/did-handle'
import * as repoRoot from './tables/repo-root'
import * as didCache from './tables/did-cache'
import * as refreshToken from './tables/refresh-token'
import * as appPassword from './tables/app-password'
import * as record from './tables/record'
import * as backlink from './tables/backlink'
import * as ipldBlock from './tables/ipld-block'
import * as inviteCode from './tables/invite-code'
import * as notification from './tables/user-notification'
import * as blob from './tables/blob'
import * as repoBlob from './tables/repo-blob'
import * as deleteAccountToken from './tables/delete-account-token'
import * as moderation from './tables/moderation'
import * as mute from './tables/mute'
import * as listMute from './tables/list-mute'
import * as repoSeq from './tables/repo-seq'
import * as appMigration from './tables/app-migration'
import * as runtimeFlag from './tables/runtime-flag'

export type DatabaseSchemaType = runtimeFlag.PartialDB &
  appMigration.PartialDB &
  userAccount.PartialDB &
  userState.PartialDB &
  userPref.PartialDB &
  didHandle.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  didCache.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  ipldBlock.PartialDB &
  inviteCode.PartialDB &
  notification.PartialDB &
  blob.PartialDB &
  repoBlob.PartialDB &
  deleteAccountToken.PartialDB &
  moderation.PartialDB &
  mute.PartialDB &
  listMute.PartialDB &
  repoSeq.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema

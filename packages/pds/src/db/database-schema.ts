import { Kysely } from 'kysely'
import * as userAccount from './tables/user-account'
import * as userPref from './tables/user-pref'
import * as didHandle from './tables/did-handle'
import * as repoRoot from './tables/repo-root'
import * as didCache from './tables/did-cache'
import * as refreshToken from './tables/refresh-token'
import * as appPassword from './tables/app-password'
import * as record from './tables/record'
import * as backlink from './tables/backlink'
import * as repoCommitBlock from './tables/repo-commit-block'
import * as repoCommitHistory from './tables/repo-commit-history'
import * as ipldBlock from './tables/ipld-block'
import * as inviteCode from './tables/invite-code'
import * as blob from './tables/blob'
import * as repoBlob from './tables/repo-blob'
import * as deleteAccountToken from './tables/delete-account-token'
import * as moderation from './tables/moderation'
import * as repoSeq from './tables/repo-seq'
import * as appMigration from './tables/app-migration'

export type DatabaseSchemaType = appMigration.PartialDB &
  userAccount.PartialDB &
  userPref.PartialDB &
  didHandle.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  didCache.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  repoCommitBlock.PartialDB &
  repoCommitHistory.PartialDB &
  ipldBlock.PartialDB &
  inviteCode.PartialDB &
  blob.PartialDB &
  repoBlob.PartialDB &
  deleteAccountToken.PartialDB &
  moderation.PartialDB &
  repoSeq.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema

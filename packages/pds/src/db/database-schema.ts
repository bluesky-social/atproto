import { Kysely } from 'kysely'
import * as userAccount from './tables/user-account'
import * as userState from './tables/user-state'
import * as didHandle from './tables/did-handle'
import * as repoRoot from './tables/repo-root'
import * as refreshToken from './tables/refresh-token'
import * as appPassword from './tables/app-password'
import * as record from './tables/record'
import * as backlink from './tables/backlink'
import * as repoCommitBlock from './tables/repo-commit-block'
import * as repoCommitHistory from './tables/repo-commit-history'
import * as ipldBlock from './tables/ipld-block'
import * as inviteCode from './tables/invite-code'
import * as notification from './tables/user-notification'
import * as blob from './tables/blob'
import * as repoBlob from './tables/repo-blob'
import * as deleteAccountToken from './tables/delete-account-token'
import * as moderation from './tables/moderation'
import * as mute from './tables/mute'
import * as label from './tables/label'
import * as repoSeq from './tables/repo-seq'
import * as appMigration from './tables/app-migration'
import * as appView from '../app-view/db'

export type DatabaseSchemaType = appView.DatabaseSchemaType &
  appMigration.PartialDB &
  userAccount.PartialDB &
  userState.PartialDB &
  didHandle.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  repoCommitBlock.PartialDB &
  repoCommitHistory.PartialDB &
  ipldBlock.PartialDB &
  repoCommitBlock.PartialDB &
  repoCommitHistory.PartialDB &
  inviteCode.PartialDB &
  notification.PartialDB &
  blob.PartialDB &
  repoBlob.PartialDB &
  deleteAccountToken.PartialDB &
  moderation.PartialDB &
  mute.PartialDB &
  label.PartialDB &
  repoSeq.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema

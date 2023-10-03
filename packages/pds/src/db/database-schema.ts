import { Kysely } from 'kysely'
import * as userAccount from './tables/user-account'
import * as didHandle from './tables/did-handle'
import * as repoRoot from './tables/repo-root'
import * as didCache from './tables/did-cache'
import * as refreshToken from './tables/refresh-token'
import * as appPassword from './tables/app-password'
import * as inviteCode from './tables/invite-code'
import * as emailToken from './tables/email-token'
import * as moderation from './tables/moderation'
import * as repoSeq from './tables/repo-seq'
import * as appMigration from './tables/app-migration'
import * as runtimeFlag from './tables/runtime-flag'

export type DatabaseSchemaType = appMigration.PartialDB &
  runtimeFlag.PartialDB &
  userAccount.PartialDB &
  didHandle.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  didCache.PartialDB &
  inviteCode.PartialDB &
  emailToken.PartialDB &
  moderation.PartialDB &
  repoSeq.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema

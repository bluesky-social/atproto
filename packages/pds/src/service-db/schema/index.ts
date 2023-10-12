import * as userAccount from './user-account'
import * as didHandle from './did-handle'
import * as repoRoot from './repo-root'
import * as didCache from './did-cache'
import * as refreshToken from './refresh-token'
import * as appPassword from './app-password'
import * as inviteCode from './invite-code'
import * as emailToken from './email-token'
import * as moderation from './moderation'
import * as appMigration from './app-migration'

export type DatabaseSchema = appMigration.PartialDB &
  userAccount.PartialDB &
  didHandle.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  didCache.PartialDB &
  inviteCode.PartialDB &
  emailToken.PartialDB &
  moderation.PartialDB

export type { UserAccount, UserAccountEntry } from './user-account'
export type { DidHandle } from './did-handle'
export type { RepoRoot } from './repo-root'
export type { DidCache } from './did-cache'
export type { RefreshToken } from './refresh-token'
export type { AppPassword } from './app-password'
export type { InviteCode, InviteCodeUse } from './invite-code'
export type { EmailToken, EmailTokenPurpose } from './email-token'
export type {
  ModerationAction,
  ModerationActionSubjectBlob,
  ModerationReport,
  ModerationReportResolution,
} from './moderation'
export type { AppMigration } from './app-migration'

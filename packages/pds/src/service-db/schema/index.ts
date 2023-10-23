import * as userAccount from './user-account'
import * as repoRoot from './repo-root'
import * as refreshToken from './refresh-token'
import * as appPassword from './app-password'
import * as inviteCode from './invite-code'
import * as emailToken from './email-token'
import * as appMigration from './app-migration'

export type DatabaseSchema = appMigration.PartialDB &
  userAccount.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  inviteCode.PartialDB &
  emailToken.PartialDB

export type { UserAccount, UserAccountEntry } from './user-account'
export type { RepoRoot } from './repo-root'
export type { RefreshToken } from './refresh-token'
export type { AppPassword } from './app-password'
export type { InviteCode, InviteCodeUse } from './invite-code'
export type { EmailToken, EmailTokenPurpose } from './email-token'
export type { AppMigration } from './app-migration'

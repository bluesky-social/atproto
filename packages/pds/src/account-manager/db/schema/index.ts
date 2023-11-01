import * as actor from './actor'
import * as account from './account'
import * as repoRoot from './repo-root'
import * as refreshToken from './refresh-token'
import * as appPassword from './app-password'
import * as inviteCode from './invite-code'
import * as emailToken from './email-token'

export type DatabaseSchema = actor.PartialDB &
  account.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  inviteCode.PartialDB &
  emailToken.PartialDB

export type { Actor, ActorEntry } from './actor'
export type { Account, AccountEntry } from './account'
export type { RepoRoot } from './repo-root'
export type { RefreshToken } from './refresh-token'
export type { AppPassword } from './app-password'
export type { InviteCode, InviteCodeUse } from './invite-code'
export type { EmailToken, EmailTokenPurpose } from './email-token'

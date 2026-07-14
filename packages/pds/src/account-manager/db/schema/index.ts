import type * as accountDevice from './account-device.js'
import type * as account from './account.js'
import type * as actor from './actor.js'
import type * as appPassword from './app-password.js'
import type * as oauthRequest from './authorization-request.js'
import type * as authorizedClient from './authorized-client.js'
import type * as device from './device.js'
import type * as emailToken from './email-token.js'
import type * as inviteCode from './invite-code.js'
import type * as lexicon from './lexicon.js'
import type * as refreshToken from './refresh-token.js'
import type * as repoRoot from './repo-root.js'
import type * as token from './token.js'
import type * as usedRefreshToken from './used-refresh-token.js'

export type DatabaseSchema = actor.PartialDB &
  account.PartialDB &
  accountDevice.PartialDB &
  authorizedClient.PartialDB &
  device.PartialDB &
  oauthRequest.PartialDB &
  token.PartialDB &
  usedRefreshToken.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  inviteCode.PartialDB &
  lexicon.PartialDB &
  emailToken.PartialDB

export type { Actor, ActorEntry } from './actor.js'
export type { Account, AccountEntry } from './account.js'
export type { AccountDevice } from './account-device.js'
export type { Device } from './device.js'
export type { AuthorizationRequest } from './authorization-request.js'
export type { Token } from './token.js'
export type { Lexicon } from './lexicon.js'
export type { UsedRefreshToken } from './used-refresh-token.js'
export type { RepoRoot } from './repo-root.js'
export type { RefreshToken } from './refresh-token.js'
export type { AppPassword } from './app-password.js'
export type { InviteCode, InviteCodeUse } from './invite-code.js'
export type { EmailToken, EmailTokenPurpose } from './email-token.js'

import * as actor from './actor'
import * as account from './account'
import * as device from './device'
import * as deviceAccount from './device-account'
import * as oauthRequest from './authorization-request'
import * as token from './token'
import * as usedRefreshToken from './used-refresh-token'
import * as repoRoot from './repo-root'
import * as refreshToken from './refresh-token'
import * as appPassword from './app-password'
import * as inviteCode from './invite-code'
import * as emailToken from './email-token'
import * as siwe from './siwe'

export type DatabaseSchema = actor.PartialDB &
  account.PartialDB &
  device.PartialDB &
  deviceAccount.PartialDB &
  oauthRequest.PartialDB &
  token.PartialDB &
  usedRefreshToken.PartialDB &
  refreshToken.PartialDB &
  appPassword.PartialDB &
  repoRoot.PartialDB &
  inviteCode.PartialDB &
  emailToken.PartialDB & 
  siwe.PartialDB

export type { Actor, ActorEntry } from './actor'
export type { Account, AccountEntry } from './account'
export type { Device } from './device'
export type { DeviceAccount } from './device-account'
export type { AuthorizationRequest } from './authorization-request'
export type { Token } from './token'
export type { UsedRefreshToken } from './used-refresh-token'
export type { RepoRoot } from './repo-root'
export type { RefreshToken } from './refresh-token'
export type { AppPassword } from './app-password'
export type { InviteCode, InviteCodeUse } from './invite-code'
export type { EmailToken, EmailTokenPurpose } from './email-token'
export type { SIWE } from './siwe'

import * as account from './account'
import * as accountDevice from './account-device'
import * as actor from './actor'
import * as appPassword from './app-password'
import * as oauthRequest from './authorization-request'
import * as authorizedClient from './authorized-client'
import * as device from './device'
import * as emailToken from './email-token'
import * as inviteCode from './invite-code'
import * as lexicon from './lexicon'
import * as neuroIdentityLink from './neuro-identity-link'
import * as neuroPendingSession from './neuro-pending-session'
import * as neuroProvisionNonce from './neuro-provision-nonce'
import * as pendingInvitations from './pending-invitations'
import * as refreshToken from './refresh-token'
import * as repoRoot from './repo-root'
import * as token from './token'
import * as usedRefreshToken from './used-refresh-token'

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
  emailToken.PartialDB &
  neuroIdentityLink.PartialDB &
  neuroPendingSession.PartialDB &
  neuroProvisionNonce.PartialDB &
  pendingInvitations.PartialDB

export type { Actor, ActorEntry } from './actor'
export type { Account, AccountEntry } from './account'
export type { AccountDevice } from './account-device'
export type { Device } from './device'
export type { AuthorizationRequest } from './authorization-request'
export type { Token } from './token'
export type { Lexicon } from './lexicon'
export type { UsedRefreshToken } from './used-refresh-token'
export type { RepoRoot } from './repo-root'
export type { RefreshToken } from './refresh-token'
export type { AppPassword } from './app-password'
export type { InviteCode, InviteCodeUse } from './invite-code'
export type { EmailToken, EmailTokenPurpose } from './email-token'
export type { NeuroIdentityLink } from './neuro-identity-link'
export type { NeuroPendingSession } from './neuro-pending-session'
export type {
  PendingInvitation,
  PendingInvitationEntry,
} from './pending-invitations'
export type { NeuroProvisionNonce } from './neuro-provision-nonce'

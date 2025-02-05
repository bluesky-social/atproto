import express from 'express'
import { INVALID_HANDLE } from '@atproto/syntax'
import { ActorAccount } from '../../../../account-manager/helpers/account'
import { CodeDetail } from '../../../../account-manager/helpers/invite'

// Output designed to passed as second arg to AtpAgent methods.
// The encoding field here is a quirk of the AtpAgent.
export function authPassthru(
  req: express.Request,
  withEncoding?: false,
): { headers: { authorization: string }; encoding: undefined } | undefined

export function authPassthru(
  req: express.Request,
  withEncoding: true,
):
  | { headers: { authorization: string }; encoding: 'application/json' }
  | undefined

export function authPassthru(req: express.Request, withEncoding?: boolean) {
  if (req.headers.authorization) {
    return {
      headers: { authorization: req.headers.authorization },
      encoding: withEncoding ? 'application/json' : undefined,
    }
  }
}

export function formatAccountInfo(
  account: ActorAccount,
  {
    managesOwnInvites,
    invitedBy,
    invites,
  }: {
    managesOwnInvites: boolean
    invites: Map<string, CodeDetail[]> | CodeDetail[]
    invitedBy: Record<string, CodeDetail>
  },
) {
  let invitesResults: CodeDetail[] | undefined
  if (managesOwnInvites) {
    if (Array.isArray(invites)) {
      invitesResults = invites
    } else {
      invitesResults = invites.get(account.did) || []
    }
  }
  return {
    did: account.did,
    handle: account.handle ?? INVALID_HANDLE,
    email: account.email ?? undefined,
    indexedAt: account.createdAt,
    emailConfirmedAt: account.emailConfirmedAt ?? undefined,
    invitedBy: managesOwnInvites ? invitedBy[account.did] : undefined,
    invites: invitesResults,
    invitesDisabled: managesOwnInvites
      ? account.invitesDisabled === 1
      : undefined,
    deactivatedAt: account.deactivatedAt ?? undefined,
  }
}

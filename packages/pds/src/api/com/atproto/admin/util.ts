import express from 'express'
import { l } from '@atproto/lex'
import { INVALID_HANDLE } from '@atproto/syntax'
import { ActorAccount } from '../../../../account-manager/helpers/account'
import { CodeDetail } from '../../../../account-manager/helpers/invite'
import { com } from '../../../../lexicons/index.js'

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
): com.atproto.admin.defs.AccountView {
  let invitesResults: CodeDetail[] | undefined
  if (managesOwnInvites) {
    if (Array.isArray(invites)) {
      invitesResults = invites
    } else {
      invitesResults = invites.get(account.did) || []
    }
  }
  return {
    did: account.did as l.DidString,
    handle: (account.handle ?? INVALID_HANDLE) as l.HandleString,
    email: account.email ?? undefined,
    indexedAt: account.createdAt as l.DatetimeString,
    emailConfirmedAt:
      (account.emailConfirmedAt as l.DatetimeString | undefined) ?? undefined,
    invitedBy: managesOwnInvites ? invitedBy[account.did] : undefined,
    invites: invitesResults,
    invitesDisabled: managesOwnInvites
      ? account.invitesDisabled === 1
      : undefined,
    deactivatedAt:
      (account.deactivatedAt as l.DatetimeString | undefined) ?? undefined,
  }
}

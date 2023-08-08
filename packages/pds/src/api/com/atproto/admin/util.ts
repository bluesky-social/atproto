import express from 'express'
import {
  RepoView,
  RepoViewDetail,
} from '../../../../lexicon/types/com/atproto/admin/defs'

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

// @NOTE mutates.
// merges-in details that the pds knows about the repo.
export function mergeRepoViewPdsDetails<T extends RepoView | RepoViewDetail>(
  other: T,
  pds: T,
) {
  other.email ??= pds.email
  other.invites ??= pds.invites
  other.invitedBy ??= pds.invitedBy
  other.invitesDisabled ??= pds.invitesDisabled
  return other
}

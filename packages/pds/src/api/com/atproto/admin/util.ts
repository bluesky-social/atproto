import {
  RepoView,
  RepoViewDetail,
} from '../../../../lexicon/types/com/atproto/admin/defs'

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

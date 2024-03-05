/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

/** Repo hosting status indicating that an administrator has taken down the repo, for a permanent period (though this may be reversed). */
export const TAKENDOWN = 'com.atproto.sync.defs#takendown'
/** Repo hosting status indicating that an administrator has taken down the repo, for a limited (but possibly indefinite) time period. */
export const SUSPENDED = 'com.atproto.sync.defs#suspended'
/** Repo hosting status indicating that the repository has been removed. The repo may be re-opened or migrated back to this host in the future, but the contents have been deleted for now. Does not clarify if the account self-deleted or an administrator or operator intervened. */
export const DELETED = 'com.atproto.sync.defs#deleted'
/** Repo hosting status indicating that the repository has been pause and should not be re-distributed, usually on request of the account holder. This may be temporary or indefinite. */
export const DEACTIVATED = 'com.atproto.sync.defs#deactivated'

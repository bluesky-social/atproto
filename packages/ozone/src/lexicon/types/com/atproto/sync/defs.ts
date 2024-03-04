/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

/** Account hosting status indicating that an administrator has taken down the account, for a permanent period (though this may be reversed). */
export const TAKENDOWN = 'com.atproto.sync.defs#takendown'
/** Account hosting status indicating that an administrator has taken down the account, for a limited (but possibly indefinite) time period. */
export const SUSPENDED = 'com.atproto.sync.defs#suspended'
/** Account hosting status indicating that the repository has been removed. The account may be re-opened or migrated back to this host in the future, but the contents have been deleted for now. Does not clarify if the account self-deleted or an administrator or operator intervened. */
export const DELETED = 'com.atproto.sync.defs#deleted'
/** Account hosting status indicating that the repository has been pause and should not be re-distributed, usually on request of the account holder. This may be temporary or indefinite. */
export const DEACTIVATED = 'com.atproto.sync.defs#deactivated'

import * as managedspace from '../lexicons/com/atproto/managedspace.js'
import { SpacePolicyManager } from './space-policy-manager.js'

export { managedspace }

/**
 * Manages a space governed by `com.atproto.managedspace.policy`: access is
 * decided by an external managing app. The policy's configuration (e.g. its
 * `managingApp`) is changed with `updatePolicy()`.
 */
export class ManagedspacePolicyManager extends SpacePolicyManager<managedspace.policy.Main> {
  static readonly schema = managedspace.policy.main
}

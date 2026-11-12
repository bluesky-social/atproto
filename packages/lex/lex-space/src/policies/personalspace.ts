import * as personalspace from '../lexicons/com/atproto/personalspace.js'
import { SpacePolicyManager } from './space-policy-manager.js'

export { personalspace }

/**
 * Manages a space governed by `com.atproto.personalspace.policy`: only the
 * space authority has access. The policy has no configuration.
 */
export class PersonalspacePolicyManager extends SpacePolicyManager<personalspace.policy.Main> {
  static readonly schema = personalspace.policy.main
}

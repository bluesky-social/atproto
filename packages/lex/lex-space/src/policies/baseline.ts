import { ManagedspacePolicyManager } from './managedspace.js'
import { MemberspacePolicyManager } from './memberspace.js'
import { PersonalspacePolicyManager } from './personalspace.js'
import type { SpacePolicyManager } from './space-policy-manager.js'

/** The managers of the baseline policies, which every PDS supports. */
export const baselineSpacePolicies = Object.freeze([
  PersonalspacePolicyManager,
  MemberspacePolicyManager,
  ManagedspacePolicyManager,
] as const) satisfies readonly SpacePolicyManager.Class[]

export type BaselineSpacePolicyManager = InstanceType<
  (typeof baselineSpacePolicies)[number]
>

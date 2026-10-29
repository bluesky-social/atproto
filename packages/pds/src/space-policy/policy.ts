import { l } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { com } from '../lexicons/index.js'

const { personalspace, memberspace, managedspace } = com.atproto

/** A policy as it arrives on the wire: an open union. */
export type LexPolicy = com.atproto.space.createSpace.$InputBody['policy']

// The same union, for a policy that arrives outside of a method's input.
const lexPolicySchema = l.typedUnion(
  [
    l.typedRef(() => personalspace.policy.main),
    l.typedRef(() => memberspace.policy.main),
    l.typedRef(() => managedspace.policy.main),
  ],
  false,
)

/** A policy this host implements. Every PDS must support the baseline policies. */
export type Policy =
  | l.$Typed<com.atproto.personalspace.policy.Main>
  | l.$Typed<com.atproto.memberspace.policy.Main>
  | l.$Typed<com.atproto.managedspace.policy.Main>

/**
 * Check that this host implements a requested policy, and fill in its defaults, so
 * that what is stored is exactly what is enforced.
 *
 * Unknown fields are dropped, as Lexicon evolution allows. A change that can't
 * safely be ignored comes as a new policy rather than a new field.
 */
export function normalizePolicy(policy: LexPolicy): Policy {
  if (personalspace.policy.$isTypeOf(policy)) {
    return personalspace.policy.$build({})
  }
  if (memberspace.policy.$isTypeOf(policy)) {
    return memberspace.policy.$build({
      publicRead: policy.publicRead ?? false,
      publicWrite: policy.publicWrite ?? false,
      allowedApps: policy.allowedApps,
      publishPolicy: policy.publishPolicy ?? false,
      publishMembers: policy.publishMembers ?? false,
    })
  }
  if (managedspace.policy.$isTypeOf(policy)) {
    const { managingApp } = policy
    if (!managingApp.startsWith('did:')) {
      throw new InvalidRequestError(
        `managingApp must be a DID with an optional service fragment, got: ${managingApp}`,
      )
    }
    return managedspace.policy.$build({
      managingApp,
      publishPolicy: policy.publishPolicy ?? false,
    })
  }
  throw new InvalidRequestError(
    `Unsupported policy: ${policy.$type}`,
    'UnsupportedPolicy',
  )
}

/**
 * Validate a policy that no lexicon has checked yet, such as one from a space host
 * archive, then normalize it as {@link normalizePolicy} does.
 */
export function parsePolicy(value: unknown): Policy {
  const result = lexPolicySchema.safeParse(value)
  if (!result.success) {
    throw new InvalidRequestError(`Invalid policy: ${result.reason.message}`)
  }
  return normalizePolicy(result.value)
}

// The member list and the methods that manage it belong to the memberspace policy.
export function assertMemberspace(policy: Policy): void {
  if (!memberspace.policy.$isTypeOf(policy)) {
    throw new InvalidRequestError(
      'Space is not governed by the memberspace policy',
      'PolicyMismatch',
    )
  }
}

/**
 * Whether the policy authorizes any user to read. Only then can a credential be
 * minted without a delegation token saying who the user is.
 */
export function isPublicRead(policy: Policy): boolean {
  return memberspace.policy.$isTypeOf(policy) && policy.publicRead === true
}

export function isPolicyPublished(policy: Policy): boolean {
  if (
    memberspace.policy.$isTypeOf(policy) ||
    managedspace.policy.$isTypeOf(policy)
  ) {
    return policy.publishPolicy === true
  }
  return false
}

export function areMembersPublished(policy: Policy): boolean {
  return memberspace.policy.$isTypeOf(policy) && policy.publishMembers === true
}

/**
 * Only memberspace restricts apps. Evaluated against the attested client_id, so an
 * app that presents no client attestation is never one of the allowed apps.
 */
export function isAppAuthorized(policy: Policy, clientId?: string): boolean {
  if (!memberspace.policy.$isTypeOf(policy)) return true
  if (!policy.allowedApps) return true
  return clientId !== undefined && policy.allowedApps.includes(clientId)
}

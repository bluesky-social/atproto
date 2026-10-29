import type { l } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { com } from '../lexicons/index.js'

const { personalspace, memberspace, managedspace } = com.atproto

/** A policy as it arrives on the wire: an open union. */
export type LexPolicy = com.atproto.space.createSpace.$InputBody['policy']

/** A policy this host implements. Every PDS must support the baseline policies. */
export type Policy =
  | l.$Typed<com.atproto.personalspace.policy.Main>
  | l.$Typed<com.atproto.memberspace.policy.Main>
  | l.$Typed<com.atproto.managedspace.policy.Main>

/**
 * Check that this host implements a requested policy and every value within it, and
 * fill in its defaults, so that what is stored is exactly what is enforced. A host
 * will not store a policy it cannot enforce.
 *
 * Unknown fields are dropped, as Lexicon evolution allows. A change that can't
 * safely be ignored comes as a new policy rather than a new field.
 */
export function normalizePolicy(policy: LexPolicy): Policy {
  if (personalspace.policy.$isTypeOf(policy)) {
    return personalspace.policy.$build({
      allowedApps: policy.allowedApps,
    })
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
        'UnsupportedPolicy',
      )
    }
    return managedspace.policy.$build({
      managingApp,
      allowedApps: policy.allowedApps,
      publishPolicy: policy.publishPolicy ?? false,
    })
  }
  throw new InvalidRequestError(
    `Unsupported policy: ${policy.$type}`,
    'UnsupportedPolicy',
  )
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
 * Evaluated against the attested client_id, so an app that presents no client
 * attestation is never one of the allowed apps.
 */
export function isAppAuthorized(policy: Policy, clientId?: string): boolean {
  if (!policy.allowedApps) return true
  return clientId !== undefined && policy.allowedApps.includes(clientId)
}

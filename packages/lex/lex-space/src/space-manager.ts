import {
  type Agent,
  type AuthenticatedAgent,
  type DidString,
  type XrpcOptions,
  type XrpcResponseBody,
  isAuthenticatedAgent,
  xrpc,
} from '@atproto/lex-client'
import { SpaceRef, type SpaceRefString } from '@atproto/syntax'
import { UnsupportedSpacePolicyError } from './errors.js'
import deleteSpace from './lexicons/com/atproto/space/deleteSpace.js'
import getSpace from './lexicons/com/atproto/space/getSpace.js'
import removeWriter from './lexicons/com/atproto/space/removeWriter.js'
import updateSpace from './lexicons/com/atproto/space/updateSpace.js'
import {
  type BaselineSpacePolicyManager,
  baselineSpacePolicies,
} from './policies/baseline.js'
import type {
  SpacePolicy,
  SpacePolicyManager,
} from './policies/space-policy-manager.js'

export type { BaselineSpacePolicyManager, SpacePolicy }

export declare namespace SpaceManager {
  export type PolicyManagerClass<TInstance = unknown> =
    SpacePolicyManager.Class<TInstance>

  export type CallOptions = Omit<
    XrpcOptions,
    'params' | 'body' | 'encoding' | 'service' | 'labelers'
  >

  export type ManagePolicyOptions<
    P extends readonly PolicyManagerClass[] | undefined,
  > = {
    /**
     * The managers of the policies to accept, in place of the baseline ones: e.g.
     * to only accept a memberspace, or to support another policy.
     *
     * @default baselineSpacePolicies
     */
    policies?: P
    signal?: AbortSignal
  }

  /**
   * The manager of a space governed by one of the policies in `P`, or by any
   * baseline policy when `P` is `undefined`.
   */
  export type PolicyManagerOf<
    P extends readonly PolicyManagerClass[] | undefined,
  > = undefined extends P
    ? BaselineSpacePolicyManager
    : InstanceType<NonNullable<P>[number]>
}

/**
 * Manages a space as its authority, whatever its policy: its lifecycle, and
 * the API of its policy (see {@link managePolicy}).
 *
 * @example
 * ```typescript
 * const manager = await SpaceManager.open(client.agent, spaceUri)
 * if (manager instanceof MemberspacePolicyManager) {
 *   await manager.putMembers([{ did, read: true, write: true }])
 * }
 *
 * const space = new SpaceManager(client.agent, spaceUri)
 * await space.updateSpace(managedspacePolicy.$build({ managingApp }))
 * await space.deleteSpace()
 * ```
 */
export class SpaceManager {
  readonly ref: SpaceRef
  readonly uri: SpaceRefString

  /**
   * Gets the manager of the policy governing a space of the user of `agent`
   * (see {@link managePolicy}).
   *
   * @throws {TypeError} if `agent` does not act for the space authority
   * @throws {UnsupportedSpacePolicyError} if the space is not governed by one
   * of `policies`
   *
   * @example
   * ```typescript
   * const members = await SpaceManager.open(client.agent, spaceUri, {
   *   policies: [MemberspacePolicyManager],
   * })
   * await members.putMembers([{ did, read: true, write: true }])
   * ```
   */
  static async open<
    const P extends readonly SpaceManager.PolicyManagerClass[] | undefined =
      undefined,
  >(
    agent: Agent,
    space: SpaceRefString | SpaceRef,
    options?: SpaceManager.ManagePolicyOptions<P>,
  ): Promise<SpaceManager.PolicyManagerOf<P>> {
    if (!isAuthenticatedAgent(agent)) {
      throw new TypeError('Agent must be authenticated')
    }
    return new SpaceManager(agent, space).managePolicy(options)
  }

  /**
   * @throws {TypeError} if `agent` does not act for the space authority
   */
  constructor(
    /** The agent of the space authority. */
    readonly agent: AuthenticatedAgent,
    ref: SpaceRefString | SpaceRef,
  ) {
    this.ref = typeof ref === 'string' ? SpaceRef.parse(ref) : ref
    this.uri = this.ref.toString()
    if (agent.did !== this.ref.spaceDid) {
      throw new TypeError(
        `Only the space authority (${this.ref.spaceDid}) can manage ${this.uri}`,
      )
    }
  }

  /** Gets the space, including the policy governing it. */
  async getSpace(
    options: SpaceManager.CallOptions = {},
  ): Promise<XrpcResponseBody<typeof getSpace>> {
    const { body } = await xrpc(this.agent, getSpace, {
      ...options,
      params: { space: this.uri },
    })
    return body
  }

  /**
   * Replaces the policy of the space wholesale. A policy of another `$type`
   * migrates the space, discarding the state of the previous policy (e.g. a
   * member list).
   */
  async updateSpace(
    policy: SpacePolicy,
    options: SpaceManager.CallOptions = {},
  ): Promise<void> {
    await xrpc(this.agent, updateSpace, {
      ...options,
      body: { space: this.uri, policy },
    })
  }

  /**
   * Deletes the space, and the authority's repo in it. Other members' repos
   * are left in place.
   */
  async deleteSpace(options: SpaceManager.CallOptions = {}): Promise<void> {
    await xrpc(this.agent, deleteSpace, {
      ...options,
      body: { space: this.uri },
    })
  }

  /** Removes an account's repo from the writer set of the space. */
  async removeWriter(
    repo: DidString,
    options: SpaceManager.CallOptions = {},
  ): Promise<void> {
    await xrpc(this.agent, removeWriter, {
      ...options,
      body: { space: this.uri, repo },
    })
  }

  /**
   * Gets the manager of the policy governing the space, from the first of
   * `policies` whose schema matches it.
   *
   * @throws {UnsupportedSpacePolicyError} if the space is not governed by one
   * of `policies`
   *
   * @example
   * ```typescript
   * const manager = await space.managePolicy({
   *   policies: [MemberspacePolicyManager],
   * })
   * await manager.putMembers([{ did, read: true, write: true }])
   * ```
   */
  async managePolicy<
    const P extends readonly SpaceManager.PolicyManagerClass[] | undefined =
      undefined,
  >({
    policies = baselineSpacePolicies,
    signal,
  }: SpaceManager.ManagePolicyOptions<P> = {}): Promise<
    SpaceManager.PolicyManagerOf<P>
  > {
    const { policy } = await this.getSpace({ signal })
    const Manager = policies.find(({ schema }) => schema.matches(policy))
    if (!Manager) throw new UnsupportedSpacePolicyError(policy)
    const manager = new Manager(this.agent, this.ref, policy)
    return manager as SpaceManager.PolicyManagerOf<P>
  }
}

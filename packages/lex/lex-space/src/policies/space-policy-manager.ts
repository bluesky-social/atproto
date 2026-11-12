import {
  type AccountAgent,
  type InferMethodOutputBody,
  type XrpcOptions,
  xrpc,
} from '@atproto/lex-client'
import type { TypedObjectSchema, Un$Typed } from '@atproto/lex-schema'
import type { SpaceRef, SpaceRefString } from '@atproto/syntax'
import getSpace from '../lexicons/com/atproto/space/getSpace.js'
import updateSpace from '../lexicons/com/atproto/space/updateSpace.js'

/**
 * The policy governing a space: one of the baseline policies, or any other
 * policy (identified by its `$type`) the space host implements.
 */
export type SpacePolicy = InferMethodOutputBody<typeof getSpace>['policy']

export declare namespace SpacePolicyManager {
  export type CallOptions = Omit<
    XrpcOptions,
    'params' | 'body' | 'encoding' | 'service' | 'labelers'
  >

  /**
   * Manages the spaces governed by the policies matching its `schema`, e.g. a
   * subclass of {@link SpacePolicyManager}.
   */
  export interface Class<TInstance = unknown> {
    readonly schema: TypedObjectSchema
    new (agent: AccountAgent, ref: SpaceRef, policy: any): TInstance
  }
}

/**
 * Manages a space through the API of the policy governing it. Extend it, with
 * the policy's schema as static `schema`, to manage another policy.
 *
 * Holds the policy as read when the manager was obtained: once the space is
 * governed by another policy, policy specific methods fail with
 * `PolicyMismatch`.
 *
 * @example
 * ```typescript
 * class ForumPolicyManager extends SpacePolicyManager<forum.policy.Main> {
 *   static readonly schema = forum.policy.main
 *
 *   async ban(did: DidString) {
 *     await xrpc(this.agent, forum.ban, { body: { space: this.uri, did } })
 *   }
 * }
 *
 * const manager = await SpaceManager.open(client.agent, spaceUri, {
 *   policies: [ForumPolicyManager, ...baselineSpacePolicies],
 * })
 * ```
 */
export abstract class SpacePolicyManager<P extends { $type?: string }> {
  readonly uri: SpaceRefString
  #policy: P

  constructor(
    /** The agent of the space authority. */
    readonly agent: AccountAgent,
    readonly ref: SpaceRef,
    policy: P,
  ) {
    this.uri = ref.toString()
    this.#policy = policy
  }

  /** The policy governing the space. */
  get policy(): P {
    return this.#policy
  }

  /** The `$type` of the policy governing the space. */
  get type(): NonNullable<P['$type']> {
    return this.#policy.$type as NonNullable<P['$type']>
  }

  /**
   * Changes the configuration of the policy. The policy is replaced wholesale
   * by the space host: concurrent changes are overwritten (last write wins).
   *
   * @example
   * ```typescript
   * await manager.updatePolicy({ publicRead: true })
   * await manager.updatePolicy(({ allowedApps = [] }) => ({
   *   allowedApps: [...allowedApps, clientId],
   * }))
   * ```
   */
  async updatePolicy(
    update: Partial<Un$Typed<P>> | ((current: P) => Un$Typed<P>),
    options?: SpacePolicyManager.CallOptions,
  ): Promise<P> {
    const { type: $type } = this
    // @NOTE No rev/swap so we fetch the current policy from the server to avoid
    // overwriting concurrent changes
    const {
      body: { policy: current },
    } = await xrpc(this.agent, getSpace, {
      ...options,
      params: { space: this.uri },
    })
    const prev: P =
      current.$type === $type
        ? (current as P) // Trust the server
        : this.#policy
    // Parse to apply defaults and validation
    const next = (this.constructor as SpacePolicyManager.Class).schema.parse({
      ...(typeof update === 'function' ? update(prev) : { ...prev, ...update }),
      $type: $type,
    }) as P
    await xrpc(this.agent, updateSpace, {
      ...options,
      body: { space: this.uri, policy: next as SpacePolicy },
    })
    this.#policy = next
    return next
  }
}

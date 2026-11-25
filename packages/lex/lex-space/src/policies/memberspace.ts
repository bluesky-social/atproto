import {
  type DidString,
  type XrpcResponseBody,
  xrpc,
} from '@atproto/lex-client'
import * as memberspace from '../lexicons/com/atproto/memberspace.js'
import { SpacePolicyManager } from './space-policy-manager.js'

export { memberspace }

export declare namespace MemberspacePolicyManager {
  export type ListMembersOptions = SpacePolicyManager.CallOptions & {
    limit?: number
    cursor?: string
  }
}

/**
 * Manages a space governed by `com.atproto.memberspace.policy`: access is
 * checked against a member list, kept by the space host.
 */
export class MemberspacePolicyManager extends SpacePolicyManager<memberspace.policy.Main> {
  static readonly schema = memberspace.policy.main

  /**
   * Adds members (up to 100), or replaces their access, in a single commit. A
   * DID listed twice takes its last entry.
   */
  async putMembers(
    members: readonly memberspace.defs.Member[],
    options?: SpacePolicyManager.CallOptions,
  ): Promise<void> {
    await xrpc(this.agent, memberspace.putMembers, {
      ...options,
      body: { space: this.uri, members: [...members] },
    })
  }

  /**
   * Removes members (up to 100) in a single commit. DIDs that are not members
   * are ignored.
   */
  async removeMembers(
    dids: readonly DidString[],
    options?: SpacePolicyManager.CallOptions,
  ): Promise<void> {
    await xrpc(this.agent, memberspace.removeMembers.main, {
      ...options,
      body: { space: this.uri, dids: [...dids] },
    })
  }

  async listMembers({
    limit,
    cursor,
    ...options
  }: MemberspacePolicyManager.ListMembersOptions = {}): Promise<
    XrpcResponseBody<typeof memberspace.listMembers.main>
  > {
    const { body } = await xrpc(this.agent, memberspace.listMembers.main, {
      ...options,
      params: { space: this.uri, limit, cursor },
    })
    return body
  }

  /** Iterates over the member list, handling pagination. */
  async *members(
    options: Omit<MemberspacePolicyManager.ListMembersOptions, 'cursor'> = {},
  ): AsyncGenerator<memberspace.defs.Member, void, undefined> {
    let cursor: string | undefined
    do {
      const page = await this.listMembers({ ...options, cursor })
      yield* page.members
      cursor = page.cursor
    } while (cursor)
  }
}

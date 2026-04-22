import { MemberCommitData, SpaceMembersStorage } from '@atproto/space'
import { SpaceTransactor } from './transactor'

export class SqlMembersStorage implements SpaceMembersStorage {
  constructor(
    private txn: SpaceTransactor,
    private space: string,
  ) {}

  async getMembers(): Promise<string[]> {
    const rows = await this.txn.listMembers(this.space)
    return rows.map((r) => r.did)
  }

  async isMember(did: string): Promise<boolean> {
    return this.txn.isMember(this.space, did)
  }

  async getSetHash(): Promise<Buffer | null> {
    const state = await this.txn.getMemberState(this.space)
    return state?.setHash ?? null
  }

  async applyCommit(commit: MemberCommitData): Promise<void> {
    await this.txn.applyMemberCommit(this.space, commit)
  }

  async destroy(): Promise<void> {
    // no-op for scoped storage
  }
}

import { MemberCommitData, SpaceMembersStorage } from '@atproto/space'
import { SpaceTransactor } from './transactor.js'

export class SqlMembersStorage implements SpaceMembersStorage {
  constructor(
    private txn: SpaceTransactor,
    private space: string,
  ) {}

  async getMembers(): Promise<string[]> {
    const dids: string[] = []
    let cursor: string | undefined
    // Pull the full list in batches; this storage interface needs every member
    // (e.g. for setHash recomputation) and the reader paginates.
    while (true) {
      const rows = await this.txn.listMembers(this.space, {
        limit: 1000,
        cursor,
      })
      if (rows.length === 0) break
      for (const r of rows) dids.push(r.did)
      if (rows.length < 1000) break
      cursor = rows[rows.length - 1].did
    }
    return dids
  }

  async isMember(did: string): Promise<boolean> {
    return this.txn.isMember(this.space, did)
  }

  async getSetHashState(): Promise<Buffer | null> {
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

import { MemberCommitData, MemberOpAction } from '../types'
import { SpaceMembersStorage } from './types'

export class MemoryMembersStorage implements SpaceMembersStorage {
  private members = new Set<string>()
  private setHash: Buffer | null = null

  async getMembers(): Promise<string[]> {
    return [...this.members]
  }

  async isMember(did: string): Promise<boolean> {
    return this.members.has(did)
  }

  async getSetHash(): Promise<Buffer | null> {
    return this.setHash
  }

  async applyCommit(commit: MemberCommitData): Promise<void> {
    for (const op of commit.ops) {
      if (op.action === MemberOpAction.Add) {
        this.members.add(op.did)
      } else if (op.action === MemberOpAction.Remove) {
        this.members.delete(op.did)
      }
    }
    this.setHash = Buffer.from(commit.setHash)
  }

  async destroy(): Promise<void> {
    this.members.clear()
    this.setHash = null
  }
}

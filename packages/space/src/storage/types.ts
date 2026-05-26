import { CommitData, MemberCommitData, RepoRecord } from '../types.js'

export interface SpaceRepoStorage {
  // Record reads
  getRecord(collection: string, rkey: string): Promise<RepoRecord | null>
  hasRecord(collection: string, rkey: string): Promise<boolean>
  listCollections(): Promise<string[]>
  listRecords(
    collection: string,
  ): Promise<{ rkey: string; record: RepoRecord }[]>

  // Set hash
  getSetHashState(): Promise<Buffer | null>

  // Atomic commit
  applyCommit(commit: CommitData): Promise<void>

  // Lifecycle
  destroy(): Promise<void>
}

export interface SpaceMembersStorage {
  getMembers(): Promise<string[]>
  isMember(did: string): Promise<boolean>
  getSetHashState(): Promise<Buffer | null>
  applyCommit(commit: MemberCommitData): Promise<void>
  destroy(): Promise<void>
}

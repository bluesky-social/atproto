import { CommitData, RepoRecord, SpaceStorage } from '@atproto/space'
import { SpaceTransactor } from './transactor'

/**
 * Adapts the multi-space SpaceTransactor into a single-space SpaceStorage
 * that the @atproto/space Repo class can work with.
 */
export class ScopedSpaceStorage implements SpaceStorage {
  constructor(
    private txn: SpaceTransactor,
    private space: string,
  ) {}

  async getRecord(
    collection: string,
    rkey: string,
  ): Promise<RepoRecord | null> {
    const result = await this.txn.getRecord(this.space, collection, rkey)
    return result?.value ?? null
  }

  async hasRecord(collection: string, rkey: string): Promise<boolean> {
    return this.txn.hasRecord(this.space, collection, rkey)
  }

  async listCollections(): Promise<string[]> {
    return this.txn.listCollections(this.space)
  }

  async listRecords(
    collection: string,
  ): Promise<{ rkey: string; record: RepoRecord }[]> {
    const rows = await this.txn.listRecords(this.space, collection, {
      limit: 10000,
    })
    const results: { rkey: string; record: RepoRecord }[] = []
    for (const row of rows) {
      const full = await this.txn.getRecord(this.space, collection, row.rkey)
      if (full) {
        results.push({ rkey: row.rkey, record: full.value })
      }
    }
    return results
  }

  async getSetHash(): Promise<Buffer | null> {
    return this.txn.getSetHash(this.space)
  }

  async applyCommit(commit: CommitData): Promise<void> {
    await this.txn.applyCommit(this.space, commit)
  }

  async destroy(): Promise<void> {
    // no-op for scoped storage
  }
}

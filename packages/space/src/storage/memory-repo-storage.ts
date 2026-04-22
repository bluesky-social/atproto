import { CommitData, RepoRecord, WriteOpAction } from '../types'
import { formatDataKey, parseDataKey } from '../util'
import { SpaceRepoStorage } from './types'

export class MemoryRepoStorage implements SpaceRepoStorage {
  private data = new Map<string, RepoRecord>()
  private setHash: Buffer | null = null

  async getRecord(
    collection: string,
    rkey: string,
  ): Promise<RepoRecord | null> {
    return this.data.get(formatDataKey(collection, rkey)) ?? null
  }

  async hasRecord(collection: string, rkey: string): Promise<boolean> {
    return this.data.has(formatDataKey(collection, rkey))
  }

  async listCollections(): Promise<string[]> {
    const collections = new Set<string>()
    for (const key of this.data.keys()) {
      collections.add(parseDataKey(key).collection)
    }
    return [...collections]
  }

  async listRecords(
    collection: string,
  ): Promise<{ rkey: string; record: RepoRecord }[]> {
    const results: { rkey: string; record: RepoRecord }[] = []
    for (const [key, record] of this.data) {
      const parsed = parseDataKey(key)
      if (parsed.collection === collection) {
        results.push({ rkey: parsed.rkey, record })
      }
    }
    return results
  }

  async getSetHash(): Promise<Buffer | null> {
    return this.setHash
  }

  async applyCommit(commit: CommitData): Promise<void> {
    for (const write of commit.writes) {
      const key = formatDataKey(write.collection, write.rkey)
      if (
        write.action === WriteOpAction.Create ||
        write.action === WriteOpAction.Update
      ) {
        this.data.set(key, write.record)
      } else if (write.action === WriteOpAction.Delete) {
        this.data.delete(key)
      }
    }
    this.setHash = Buffer.from(commit.setHash)
  }

  async destroy(): Promise<void> {
    this.data.clear()
    this.setHash = null
  }
}

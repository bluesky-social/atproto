import { RepoRecord } from '../types'
import { formatDataKey, parseDataKey } from '../util'
import { SpaceStorage } from './types'

export class MemoryStorage implements SpaceStorage {
  private data = new Map<string, RepoRecord>()
  private setHash: Buffer | null = null

  async getRecord(
    collection: string,
    rkey: string,
  ): Promise<RepoRecord | null> {
    return this.data.get(formatDataKey(collection, rkey)) ?? null
  }

  async putRecord(
    collection: string,
    rkey: string,
    record: RepoRecord,
  ): Promise<void> {
    this.data.set(formatDataKey(collection, rkey), record)
  }

  async deleteRecord(collection: string, rkey: string): Promise<boolean> {
    return this.data.delete(formatDataKey(collection, rkey))
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

  async putSetHash(hash: Buffer): Promise<void> {
    this.setHash = Buffer.from(hash)
  }

  async destroy(): Promise<void> {
    this.data.clear()
    this.setHash = null
  }
}

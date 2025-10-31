import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { chunkArray } from '@atproto/common'
import {
  BlockMap,
  CarBlock,
  CidSet,
  ReadableBlockstore,
  writeCarStream,
} from '@atproto/repo'
import { countAll } from '../../db'
import { ActorDb } from '../db'

export class SqlRepoReader extends ReadableBlockstore {
  cache: BlockMap = new BlockMap()

  constructor(public db: ActorDb) {
    super()
  }

  async getRoot(): Promise<CID> {
    const root = await this.getRootDetailed()
    return root.cid
  }

  async getRootDetailed(): Promise<{ cid: CID; rev: string }> {
    const res = await this.db.db
      .selectFrom('repo_root')
      .select(['cid', 'rev'])
      .limit(1)
      .executeTakeFirstOrThrow()
    return {
      cid: CID.parse(res.cid),
      rev: res.rev,
    }
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const cached = this.cache.get(cid)
    if (cached) return cached
    const found = await this.db.db
      .selectFrom('repo_block')
      .where('repo_block.cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    if (!found) return null
    this.cache.set(cid, found.content)
    return found.content
  }

  async has(cid: CID): Promise<boolean> {
    const got = await this.getBytes(cid)
    return !!got
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    const cached = this.cache.getMany(cids)
    if (cached.missing.length < 1) return cached
    const missing = new CidSet(cached.missing)
    const missingStr = cached.missing.map((c) => c.toString())
    const blocks = new BlockMap()
    for (const batch of chunkArray(missingStr, 500)) {
      const res = await this.db.db
        .selectFrom('repo_block')
        .where('repo_block.cid', 'in', batch)
        .select(['repo_block.cid as cid', 'repo_block.content as content'])
        .execute()
      for (const row of res) {
        const cid = CID.parse(row.cid)
        blocks.set(cid, row.content)
        missing.delete(cid)
      }
    }
    this.cache.addMap(blocks)
    blocks.addMap(cached.blocks)
    return { blocks, missing: missing.toList() }
  }

  async getCarStream(since?: string) {
    const root = await this.getRoot()
    if (!root) {
      throw new RepoRootNotFoundError()
    }
    return writeCarStream(root, this.iterateCarBlocks(since))
  }

  async *iterateCarBlocks(since?: string): AsyncIterable<CarBlock> {
    let cursor: RevCursor | undefined = undefined
    // allow us to write to car while fetching the next page
    do {
      const res = await this.getBlockRange(since, cursor)
      for (const row of res) {
        yield {
          cid: CID.parse(row.cid),
          bytes: row.content,
        }
      }
      const lastRow = res.at(-1)
      if (lastRow && lastRow.repoRev) {
        cursor = {
          cid: CID.parse(lastRow.cid),
          rev: lastRow.repoRev,
        }
      } else {
        cursor = undefined
      }
    } while (cursor)
  }

  async getBlockRange(since?: string, cursor?: RevCursor) {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db
      .selectFrom('repo_block')
      .select(['cid', 'repoRev', 'content'])
      .orderBy('repoRev', 'desc')
      .orderBy('cid', 'desc')
      .limit(500)
    if (cursor) {
      // use this syntax to ensure we hit the index
      builder = builder.where(
        sql`((${ref('repoRev')}, ${ref('cid')}) < (${
          cursor.rev
        }, ${cursor.cid.toString()}))`,
      )
    }
    if (since) {
      builder = builder.where('repoRev', '>', since)
    }
    return builder.execute()
  }

  async countBlocks(): Promise<number> {
    const res = await this.db.db
      .selectFrom('repo_block')
      .select(countAll.as('count'))
      .executeTakeFirst()
    return res?.count ?? 0
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}

type RevCursor = {
  cid: CID
  rev: string
}

export class RepoRootNotFoundError extends Error {}

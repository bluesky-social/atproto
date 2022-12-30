import { CID } from 'multiformats/cid'
import { CommitBlockData, CommitData, def } from '../types'
import BlockMap from '../block-map'
import { MST } from '../mst'
import { RepoStorage } from './types'
import DataDiff from '../data-diff'
import * as util from './util'
import { MissingCommitBlocksError } from './error'

export class MemoryBlockstore implements RepoStorage {
  blocks: BlockMap
  head: CID | null = null

  constructor(blocks?: BlockMap) {
    this.blocks = blocks || new BlockMap()
  }

  async getHead(): Promise<CID | null> {
    return this.head
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    return this.blocks.get(cid) || null
  }

  async has(cid: CID): Promise<boolean> {
    return this.blocks.has(cid)
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    return this.blocks.getMany(cids)
  }

  async putBlock(cid: CID, block: Uint8Array): Promise<void> {
    this.blocks.set(cid, block)
  }

  async putMany(blocks: BlockMap): Promise<void> {
    blocks.forEach((val, key) => {
      this.blocks.set(key, val)
    })
  }

  async indexCommits(commits: CommitData[]): Promise<void> {
    commits.forEach((commit) => {
      this.blocks.addMap(commit.blocks)
    })
  }

  async updateHead(cid: CID, _prev: CID | null): Promise<void> {
    this.head = cid
  }

  async applyCommit(commit: CommitData): Promise<void> {
    this.blocks.addMap(commit.blocks)
    this.head = commit.root
  }

  async getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null> {
    let curr: CID | null = latest
    const path: CID[] = []
    while (curr !== null) {
      path.push(curr)
      const commit = await util.readObj(this, curr, def.commit)
      if (earliest && curr.equals(earliest)) {
        return path.reverse()
      }
      const root = await util.readObj(this, commit.root, def.repoRoot)
      if (!earliest && root.prev === null) {
        return path.reverse()
      }
      curr = root.prev
    }
    return null
  }

  async getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }> {
    const commitData: { [commit: string]: BlockMap } = {}
    let prevData: MST | null = null
    for (const commitCid of commits) {
      const commit = await util.readObj(this, commitCid, def.commit)
      const root = await util.readObj(this, commit.root, def.repoRoot)
      const data = await MST.load(this, root.data)
      const diff = await DataDiff.of(data, prevData)
      const { blocks, missing } = await this.getBlocks([
        commitCid,
        commit.root,
        ...diff.newCidList(),
      ])
      if (missing.length > 0) {
        throw new MissingCommitBlocksError(commitCid, missing)
      }
      if (!root.prev) {
        const meta = await util.verifyObj(this, root.meta, def.repoMeta)
        blocks.set(root.meta, meta.bytes)
      }
      commitData[commitCid.toString()] = blocks
      prevData = data
    }
    return commitData
  }

  async getCommits(
    latest: CID,
    earliest: CID | null,
  ): Promise<CommitBlockData[] | null> {
    const commitPath = await this.getCommitPath(latest, earliest)
    if (!commitPath) return null
    const blocksByCommit = await this.getBlocksForCommits(commitPath)
    return commitPath.map((commit) => ({
      root: commit,
      blocks: blocksByCommit[commit.toString()] || new BlockMap(),
    }))
  }

  async sizeInBytes(): Promise<number> {
    let total = 0
    this.blocks.forEach((bytes) => {
      total += bytes.byteLength
    })
    return total
  }

  async destroy(): Promise<void> {
    this.blocks.clear()
  }

  // Mainly for dev purposes
  async getContents(): Promise<Record<string, unknown>> {
    const contents: Record<string, unknown> = {}
    for (const entry of this.blocks.entries()) {
      contents[entry.cid.toString()] = await util.readObj(
        this,
        entry.cid,
        def.unknown,
      )
    }
    return contents
  }
}

export default MemoryBlockstore

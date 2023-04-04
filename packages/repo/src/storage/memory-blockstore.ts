import { CID } from 'multiformats/cid'
import { CommitData, def, RebaseData } from '../types'
import BlockMap from '../block-map'
import { MST } from '../mst'
import DataDiff from '../data-diff'
import { MissingCommitBlocksError } from '../error'
import RepoStorage from './repo-storage'
import CidSet from '../cid-set'

export class MemoryBlockstore extends RepoStorage {
  blocks: BlockMap
  head: CID | null = null

  constructor(blocks?: BlockMap) {
    super()
    this.blocks = new BlockMap()
    if (blocks) {
      this.blocks.addMap(blocks)
    }
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
    this.blocks.addMap(blocks)
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
    this.head = commit.commit
  }

  async getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null> {
    let curr: CID | null = latest
    const path: CID[] = []
    while (curr !== null) {
      path.push(curr)
      const commit = await this.readObj(curr, def.commit)
      if (!earliest && commit.prev === null) {
        return path.reverse()
      } else if (earliest && commit.prev.equals(earliest)) {
        return path.reverse()
      }
      curr = commit.prev
    }
    return null
  }

  async getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }> {
    const commitData: { [commit: string]: BlockMap } = {}
    let prevData: MST | null = null
    for (const commitCid of commits) {
      const commit = await this.readObj(commitCid, def.commit)
      const data = await MST.load(this, commit.data)
      const diff = await DataDiff.of(data, prevData)
      const { blocks, missing } = await this.getBlocks([
        commitCid,
        ...diff.newCidList(),
      ])
      if (missing.length > 0) {
        throw new MissingCommitBlocksError(commitCid, missing)
      }
      commitData[commitCid.toString()] = blocks
      prevData = data
    }
    return commitData
  }

  async applyRebase(rebase: RebaseData) {
    this.putMany(rebase.blocks)
    const allCids = new CidSet([
      ...rebase.preservedCids,
      ...rebase.blocks.cids(),
    ])
    const toDelete: CID[] = []
    this.blocks.forEach((_bytes, cid) => {
      if (!allCids.has(cid)) {
        toDelete.push(cid)
      }
    })
    for (const cid of toDelete) {
      this.blocks.delete(cid)
    }
    await this.updateHead(rebase.commit, null)
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
}

export default MemoryBlockstore

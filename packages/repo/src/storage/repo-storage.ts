import { CID } from 'multiformats/cid'
import BlockMap from '../block-map'
import { CommitBlockData, CommitData, RebaseData } from '../types'
import ReadableBlockstore from './readable-blockstore'

export abstract class RepoStorage extends ReadableBlockstore {
  abstract getHead(forUpdate?: boolean): Promise<CID | null>
  abstract getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null>
  abstract getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }>

  abstract putBlock(cid: CID, block: Uint8Array): Promise<void>
  abstract putMany(blocks: BlockMap): Promise<void>
  abstract updateHead(cid: CID, prev: CID | null): Promise<void>
  abstract indexCommits(commit: CommitData[]): Promise<void>
  abstract applyRebase(rebase: RebaseData): Promise<void>

  async applyCommit(commit: CommitData): Promise<void> {
    await Promise.all([
      this.indexCommits([commit]),
      this.updateHead(commit.commit, commit.prev),
    ])
  }

  async getCommits(
    latest: CID,
    earliest: CID | null,
  ): Promise<CommitBlockData[] | null> {
    const commitPath = await this.getCommitPath(latest, earliest)
    if (!commitPath) return null
    const blocksByCommit = await this.getBlocksForCommits(commitPath)
    return commitPath.map((commit) => ({
      commit,
      blocks: blocksByCommit[commit.toString()] || new BlockMap(),
    }))
  }
}

export default RepoStorage

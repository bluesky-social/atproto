import { CID } from 'multiformats/cid'
import { BlockWriter } from '@ipld/car/writer'

import * as common from '@atproto/common'
import { check } from '@atproto/common'
import { DataDiff } from '../mst'
import { CommitBlockData, CommitData } from '../types'
import BlockMap from '../block-map'
import * as util from '../util'

export abstract class RepoStorage {
  temp: BlockMap = new BlockMap()

  abstract getHead(forUpdate?: boolean): Promise<CID | null>
  abstract getSavedBytes(cid: CID): Promise<Uint8Array | null>
  abstract getManySavedBytes(cids: CID[]): Promise<BlockMap>
  abstract hasSavedBytes(cid: CID): Promise<boolean>
  abstract putBlock(cid: CID, block: Uint8Array): Promise<void>
  abstract putMany(blocks: BlockMap): Promise<void>
  abstract applyCommit(commit: CommitData): Promise<void>
  abstract getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null>
  abstract getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }>
  abstract destroy(): Promise<void>

  async get<T>(cid: CID, schema: check.Def<T>): Promise<T> {
    const value = await this.getUnchecked(cid)
    try {
      return check.assure(schema, value)
    } catch (err) {
      throw new Error(
        `Did not find expected object at ${cid.toString()}: ${err}`,
      )
    }
  }

  async getUnchecked(cid: CID): Promise<unknown> {
    const bytes = await this.getBytes(cid)
    if (!bytes) {
      throw new Error(`Not found: ${cid.toString()}`)
    }
    return common.ipldBytesToValue(bytes)
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    return this.temp.get(cid) || (await this.getSavedBytes(cid))
  }

  async getMany(cids: CID[]): Promise<BlockMap> {
    const toReturn = new BlockMap()
    const checkSaved: CID[] = []
    for (const cid of cids) {
      const gotTemp = this.temp.get(cid)
      if (gotTemp) {
        toReturn.set(cid, gotTemp)
      } else {
        checkSaved.push(cid)
      }
    }
    const savedBytes = await this.getManySavedBytes(cids)
    toReturn.addMap(savedBytes)
    return toReturn
  }

  async guaranteeBytes(cid: CID): Promise<Uint8Array> {
    const bytes = await this.getBytes(cid)
    if (!bytes) {
      throw new Error(`Not found: ${cid.toString()}`)
    }
    return bytes
  }

  async has(cid: CID): Promise<boolean> {
    return this.temp.has(cid) || (await this.hasSavedBytes(cid))
  }

  async isMissing(cid: CID): Promise<boolean> {
    const has = await this.has(cid)
    return !has
  }

  async getCommits(
    latest: CID,
    earliest: CID | null,
  ): Promise<CommitBlockData[] | null> {
    const commitPath = await this.getCommitPath(latest, earliest)
    if (!commitPath) return null
    const blocksByCommits = await this.getBlocksForCommits(commitPath)
    return commitPath.map((commit) => ({
      root: commit,
      blocks: blocksByCommits[commit.toString()] || new BlockMap(),
    }))
  }

  async addToCar(car: BlockWriter, cid: CID) {
    car.put({ cid, bytes: await this.guaranteeBytes(cid) })
  }

  async loadDiff(
    carBytes: Uint8Array,
    verify: (root: CID) => Promise<DataDiff>,
  ): Promise<{ root: CID; diff: DataDiff }> {
    const { root, blocks } = await util.readCar(carBytes)
    this.temp.addMap(blocks)
    try {
      const diff = await verify(root)
      await this.putMany(this.temp)
      this.temp.clear()
      return { root, diff }
    } catch (err) {
      this.temp.clear()
      throw err
    }
  }
}

export default RepoStorage

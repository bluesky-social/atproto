import { Keypair } from '@atproto/crypto'
import { createCommit, verifyCommit } from './commit'
import { MemberAlreadyExistsError, MemberNotFoundError } from './error'
import { SetHash } from './set-hash'
import { SpaceMembersStorage } from './storage'
import {
  MemberCommitData,
  MemberOpAction,
  MemberWriteOp,
  PreparedMemberOp,
  SignedCommit,
  SpaceContext,
} from './types'

type Params = {
  storage: SpaceMembersStorage
  setHash?: SetHash
}

export class SpaceMembers {
  storage: SpaceMembersStorage
  setHash: SetHash

  constructor(params: Params) {
    this.storage = params.storage
    this.setHash = params.setHash ?? new SetHash()
  }

  static create(storage: SpaceMembersStorage): SpaceMembers {
    return new SpaceMembers({ storage })
  }

  static async load(storage: SpaceMembersStorage): Promise<SpaceMembers> {
    const stored = await storage.getSetHash()
    if (stored) {
      return new SpaceMembers({ storage, setHash: new SetHash(stored) })
    }
    return SpaceMembers.recompute(storage)
  }

  static async loadOrCreate(storage: SpaceMembersStorage): Promise<SpaceMembers> {
    const stored = await storage.getSetHash()
    if (stored) {
      return new SpaceMembers({ storage, setHash: new SetHash(stored) })
    }
    return new SpaceMembers({ storage })
  }

  static async recompute(storage: SpaceMembersStorage): Promise<SpaceMembers> {
    const setHash = new SetHash()
    const members = await storage.getMembers()
    for (const did of members) {
      await setHash.add(did)
    }
    return new SpaceMembers({ storage, setHash })
  }

  async formatCommit(
    ops: MemberWriteOp | MemberWriteOp[],
  ): Promise<MemberCommitData> {
    const operations = Array.isArray(ops) ? ops : [ops]
    const prepared: PreparedMemberOp[] = []
    const newSetHash = new SetHash(this.setHash.toBytes())

    for (const op of operations) {
      if (op.action === MemberOpAction.Add) {
        const exists = await this.storage.isMember(op.did)
        if (exists) {
          throw new MemberAlreadyExistsError(op.did)
        }
        await newSetHash.add(op.did)
        prepared.push({
          action: MemberOpAction.Add,
          did: op.did,
        })
      } else if (op.action === MemberOpAction.Remove) {
        const exists = await this.storage.isMember(op.did)
        if (!exists) {
          throw new MemberNotFoundError(op.did)
        }
        await newSetHash.remove(op.did)
        prepared.push({
          action: MemberOpAction.Remove,
          did: op.did,
        })
      }
    }

    return {
      ops: prepared,
      setHash: newSetHash.toBytes(),
    }
  }

  async applyCommit(commit: MemberCommitData): Promise<void> {
    await this.storage.applyCommit(commit)
    this.setHash = new SetHash(commit.setHash)
  }

  async addMember(did: string): Promise<MemberCommitData> {
    const commit = await this.formatCommit({
      action: MemberOpAction.Add,
      did,
    })
    await this.applyCommit(commit)
    return commit
  }

  async removeMember(did: string): Promise<MemberCommitData> {
    const commit = await this.formatCommit({
      action: MemberOpAction.Remove,
      did,
    })
    await this.applyCommit(commit)
    return commit
  }

  // Reads

  async getMembers(): Promise<string[]> {
    return this.storage.getMembers()
  }

  async isMember(did: string): Promise<boolean> {
    return this.storage.isMember(did)
  }

  // Signed commits

  async commit(space: SpaceContext, keypair: Keypair): Promise<SignedCommit> {
    return createCommit(this.setHash, space, keypair)
  }

  verifyCommit(space: SpaceContext, commit: SignedCommit): boolean {
    return (
      this.setHash.equals(new SetHash(commit.hash)) &&
      verifyCommit(space, commit)
    )
  }
}

export { MemberAlreadyExistsError, MemberNotFoundError } from './error'

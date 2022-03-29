import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { Didable, Keypair } from 'ucans'

import { RepoRoot, CarStreamable, IdMapping, Commit, schema } from './types.js'
import { DID } from '../common/types.js'
import * as check from '../common/check.js'
import IpldStore from '../blockstore/ipld-store.js'
import { streamToArray } from '../common/util.js'
import ProgramStore from './program-store.js'
import CidSet from './cid-set.js'
import Relationships from './relationships.js'

export class Repo implements CarStreamable {
  blockstore: IpldStore
  programCids: IdMapping
  programs: { [name: string]: ProgramStore }
  relationships: Relationships
  cid: CID
  did: DID
  private keypair: Keypair | null

  constructor(params: {
    blockstore: IpldStore
    programCids: IdMapping
    relationships: Relationships
    cid: CID
    did: DID
    keypair?: Keypair
  }) {
    this.blockstore = params.blockstore
    this.programCids = params.programCids
    this.programs = {}
    this.relationships = params.relationships
    this.cid = params.cid
    this.did = params.did
    this.keypair = params.keypair || null

    this.relationships.onUpdate = this.updateRoot
  }

  static async create(
    blockstore: IpldStore,
    did: string,
    keypair: Keypair & Didable,
  ) {
    const relationships = await Relationships.create(blockstore)
    const rootObj: RepoRoot = {
      did,
      prev: null,
      new_cids: await relationships.cids(),
      relationships: relationships.cid,
      programs: {},
    }

    const rootCid = await blockstore.put(rootObj)
    const commit: Commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }

    const cid = await blockstore.put(commit)
    const programCids: IdMapping = {}

    return new Repo({
      blockstore,
      programCids,
      relationships,
      cid,
      did,
      keypair,
    })
  }

  static async load(blockstore: IpldStore, cid: CID, keypair?: Keypair) {
    const commit = await blockstore.get(cid, schema.commit)
    const root = await blockstore.get(commit.root, schema.repoRoot)
    const relationships = await Relationships.load(
      blockstore,
      root.relationships,
    )
    return new Repo({
      blockstore,
      programCids: root.programs,
      relationships,
      cid,
      did: root.did,
      keypair,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    store: IpldStore,
    keypair?: Keypair,
  ) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    for await (const block of car.blocks()) {
      await store.putBytes(block.cid, block.bytes)
    }

    return Repo.load(store, root, keypair)
  }

  // arrow fn to preserve scope
  updateRootForProgram =
    (programName: string) =>
    async (newCids: CidSet): Promise<void> => {
      const program = this.programs[programName]
      if (!program) {
        throw new Error(
          `Tried to update program root for a program that doesnt exist: ${programName}`,
        )
      }
      // if a new program, make sure we add the structural nodes
      if (this.programCids[programName] === undefined) {
        newCids
          .add(program.cid)
          .add(program.posts.cid)
          .add(program.interactions.cid)
      }
      this.programCids[programName] = program.cid
      await this.updateRoot(newCids)
    }

  updateRoot = async (newCids: CidSet): Promise<void> => {
    if (this.keypair === null) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const root: RepoRoot = {
      did: this.did,
      prev: this.cid,
      new_cids: newCids.toList(),
      programs: this.programCids,
      relationships: this.relationships.cid,
    }
    const rootCid = await this.blockstore.put(root)
    newCids.add(rootCid)
    const commit: Commit = {
      root: rootCid,
      sig: await this.keypair.sign(rootCid.bytes),
    }
    this.cid = await this.blockstore.put(commit)
  }

  async getCommit(): Promise<Commit> {
    return this.blockstore.get(this.cid, schema.commit)
  }

  async getRoot(): Promise<RepoRoot> {
    const commit = await this.getCommit()
    return this.blockstore.get(commit.root, schema.repoRoot)
  }

  // Program API
  // -----------

  async createProgramStore(name: string): Promise<ProgramStore> {
    if (this.programCids[name] !== undefined) {
      throw new Error(`Program store already exists for program: ${name}`)
    }
    const programStore = await ProgramStore.create(this.blockstore)
    programStore.onUpdate = this.updateRootForProgram(name)
    this.programs[name] = programStore
    return programStore
  }

  async loadOrCreateProgramStore(name: string): Promise<ProgramStore> {
    if (this.programs[name]) {
      return this.programs[name]
    }
    const cid = this.programCids[name]
    if (!cid) {
      return this.createProgramStore(name)
    }
    const programStore = await ProgramStore.load(this.blockstore, cid)
    programStore.onUpdate = this.updateRootForProgram(name)
    this.programs[name] = programStore
    return programStore
  }

  async runOnProgram<T>(
    programName: string,
    fn: (store: ProgramStore) => Promise<T>,
  ): Promise<T> {
    const program = await this.loadOrCreateProgramStore(programName)
    return fn(program)
  }

  // IPLD store methods
  // -----------

  async put(value: Record<string, unknown> | string): Promise<CID> {
    return this.blockstore.put(value)
  }

  async get<T>(cid: CID, schema: check.Schema<T>): Promise<T> {
    return this.blockstore.get(cid, schema)
  }

  // CAR files
  // -----------

  async loadCar(buf: Uint8Array): Promise<void> {
    const car = await CarReader.fromBytes(buf)
    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const rootCid = roots[0]
    for await (const block of car.blocks()) {
      await this.blockstore.putBytes(block.cid, block.bytes)
    }
    this.cid = rootCid
    const root = await this.getRoot()
    this.did = root.did
    this.programCids = root.programs
    this.programs = {}
    this.relationships = await Relationships.load(
      this.blockstore,
      root.relationships,
    )
  }

  async getCarNoHistory(): Promise<Uint8Array> {
    return this.openCar((car: BlockWriter) => {
      return this.writeToCarStream(car)
    })
  }

  async getDiffCar(to: CID | null): Promise<Uint8Array> {
    return this.openCar((car: BlockWriter) => {
      return this.writeCommitsToCarStream(car, this.cid, to)
    })
  }

  async getFullHistory(): Promise<Uint8Array> {
    return this.getDiffCar(null)
  }

  private async openCar(
    fn: (car: BlockWriter) => Promise<void>,
  ): Promise<Uint8Array> {
    const { writer, out } = CarWriter.create([this.cid])
    await fn(writer)
    writer.close()
    return streamToArray(out)
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    await this.blockstore.addToCar(car, this.cid)
    const commit = await this.blockstore.get(this.cid, schema.commit)
    await this.blockstore.addToCar(car, commit.root)
    await this.relationships.writeToCarStream(car)
    await Promise.all(
      Object.values(this.programCids).map(async (cid) => {
        const programStore = await ProgramStore.load(this.blockstore, cid)
        await programStore.writeToCarStream(car)
      }),
    )
  }

  async writeCommitsToCarStream(
    car: BlockWriter,
    from: CID,
    to: CID | null,
  ): Promise<void> {
    const commit = await this.blockstore.get(from, schema.commit)
    const { new_cids, prev } = await this.blockstore.get(
      commit.root,
      schema.repoRoot,
    )
    await this.blockstore.addToCar(car, this.cid)
    await this.blockstore.addToCar(car, commit.root)

    await Promise.all(new_cids.map((cid) => this.blockstore.addToCar(car, cid)))
    if (!prev) {
      if (to === null) {
        return
      }
      throw new Error(`Count not find commit: $${to}`)
    }
    if (prev.toString() === to?.toString()) {
      return
    }
    await this.writeCommitsToCarStream(car, prev, to)
  }
}

export default Repo

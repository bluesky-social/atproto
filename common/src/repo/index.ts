import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import * as ucan from 'ucans'

import {
  RepoRoot,
  CarStreamable,
  IdMapping,
  Commit,
  schema,
  UpdateData,
} from './types.js'
import { DID, Keypair } from '../common/types.js'
import * as check from '../common/check.js'
import IpldStore from '../blockstore/ipld-store.js'
import { streamToArray } from '../common/util.js'
import ProgramStore from './program-store.js'
import Relationships from './relationships.js'
import {
  blueskySemantics,
  maintenanceCap,
  writeCap,
} from '../auth/bluesky-capability.js'

export class Repo implements CarStreamable {
  blockstore: IpldStore
  ucanStore: ucan.Store
  programCids: IdMapping
  programs: { [name: string]: ProgramStore }
  relationships: Relationships
  cid: CID
  did: DID
  private keypair: Keypair | null

  constructor(params: {
    blockstore: IpldStore
    ucanStore: ucan.Store
    programCids: IdMapping
    relationships: Relationships
    cid: CID
    did: DID
    keypair?: Keypair
  }) {
    this.blockstore = params.blockstore
    this.ucanStore = params.ucanStore
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
    keypair: Keypair,
    ucanStore: ucan.Store,
  ) {
    const foundUcan = await ucanStore.findWithCapability(
      keypair.did(),
      blueskySemantics,
      maintenanceCap(did),
      () => true,
    )
    if (!foundUcan.success) {
      throw new Error(`No valid Ucan for creating repo: ${foundUcan.reason}`)
    }
    const tokenCid = await blockstore.put(foundUcan.ucan.encoded())
    const relationships = await Relationships.create(blockstore)
    const rootObj: RepoRoot = {
      did,
      prev: null,
      new_cids: await relationships.cids(),
      auth_token: tokenCid, // @FIX THIS
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
      ucanStore,
      programCids,
      relationships,
      cid,
      did,
      keypair,
    })
  }

  static async load(
    blockstore: IpldStore,
    cid: CID,
    keypair?: Keypair,
    ucanStore?: ucan.Store,
  ) {
    const commit = await blockstore.get(cid, schema.commit)
    const root = await blockstore.get(commit.root, schema.repoRoot)
    const relationships = await Relationships.load(
      blockstore,
      root.relationships,
    )
    return new Repo({
      blockstore,
      ucanStore: ucanStore || (await ucan.Store.fromTokens([])),
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
    ucanStore?: ucan.Store,
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

    return Repo.load(store, root, keypair, ucanStore)
  }

  // arrow fn to preserve scope
  updateRootForProgram =
    (programName: string) =>
    async (update: UpdateData): Promise<void> => {
      const program = this.programs[programName]
      if (!program) {
        throw new Error(
          `Tried to update program root for a program that doesnt exist: ${programName}`,
        )
      }
      // if a new program, make sure we add the structural nodes
      const newCids = update.newCids
      if (this.programCids[programName] === undefined) {
        newCids
          .add(program.cid)
          .add(program.posts.cid)
          .add(program.interactions.cid)
      }
      this.programCids[programName] = program.cid
      await this.updateRoot({
        ...update,
        program: programName,
        newCids,
      })
    }

  updateRoot = async (update: UpdateData): Promise<void> => {
    if (this.keypair === null) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const newCids = update.newCids
    const tokenCid = await this.ucanForOperation(update)
    const root: RepoRoot = {
      did: this.did,
      prev: this.cid,
      new_cids: newCids.toList(),
      auth_token: tokenCid,
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

  // UCAN Auth
  // -----------

  async ucanForOperation(update: UpdateData): Promise<CID> {
    if (!this.keypair) {
      throw new Error('No keypair provided. Repo is read-only.')
    }
    const neededCap = writeCap(
      this.did,
      update.program,
      update.collection,
      update.tid,
    )
    const foundUcan = this.ucanStore.findWithCapability(
      this.keypair.did(),
      blueskySemantics,
      neededCap,
      () => true,
    )
    if (!foundUcan.success) {
      throw new Error(
        `Could not find a valid ucan for operation: ${neededCap.bluesky}`,
      )
    }
    return this.blockstore.put(foundUcan.ucan.encoded())
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

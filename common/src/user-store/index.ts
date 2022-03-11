import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { Didable, Keypair } from 'ucans'

import { UserRoot, CarStreamable, IdMapping, Commit, NewCids } from './types.js'
import { DID } from '../common/types.js'
import * as check from './type-check.js'
import IpldStore from '../blockstore/ipld-store.js'
import { streamToArray } from '../common/util.js'
import ProgramStore from './program-store.js'

export class UserStore implements CarStreamable {
  store: IpldStore
  programCids: IdMapping
  programs: { [name: string]: ProgramStore }
  cid: CID
  did: DID
  private keypair: Keypair | null

  constructor(params: {
    store: IpldStore
    programCids: IdMapping
    cid: CID
    did: DID
    keypair?: Keypair
  }) {
    this.store = params.store
    this.programCids = params.programCids
    this.programs = {}
    this.cid = params.cid
    this.did = params.did
    this.keypair = params.keypair || null
  }

  static async create(store: IpldStore, keypair: Keypair & Didable) {
    const did = await keypair.did()
    const rootObj: UserRoot = {
      did,
      prev: null,
      added: [],
      programs: {},
    }

    const rootCid = await store.put(rootObj)
    const commit: Commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }

    const cid = await store.put(commit)
    const programCids: IdMapping = {}

    return new UserStore({
      store,
      programCids,
      cid,
      did,
      keypair,
    })
  }

  static async load(store: IpldStore, cid: CID, keypair?: Keypair) {
    const commit = await store.get(cid, check.assureCommit)
    const root = await store.get(commit.root, check.assureUserRoot)
    return new UserStore({
      store,
      programCids: root.programs,
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

    return UserStore.load(store, root, keypair)
  }

  // arrow fn to preserve scope
  updateRoot =
    (programName: string) =>
    async (newCids: NewCids): Promise<void> => {
      if (this.keypair === null) {
        throw new Error('No keypair provided. UserStore is read-only.')
      }
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
          .add(program.relationships.cid)
      }
      this.programCids[programName] = program.cid
      const userRoot: UserRoot = {
        did: this.did,
        prev: this.cid,
        added: [...newCids],
        programs: this.programCids,
      }
      const userCid = await this.store.put(userRoot)
      newCids.add(userCid)
      const commit: Commit = {
        root: userCid,
        sig: await this.keypair.sign(userCid.bytes),
      }
      this.cid = await this.store.put(commit)
    }

  async getCommit(): Promise<Commit> {
    return this.store.get(this.cid, check.assureCommit)
  }

  async getRoot(): Promise<UserRoot> {
    const commit = await this.getCommit()
    return this.store.get(commit.root, check.assureUserRoot)
  }

  // Program API
  // -----------

  async createProgramStore(name: string): Promise<ProgramStore> {
    if (this.programCids[name] !== undefined) {
      throw new Error(`Program store already exists for program: ${name}`)
    }
    const programStore = await ProgramStore.create(this.store)
    programStore.onUpdate = this.updateRoot(name)
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
    const programStore = await ProgramStore.load(this.store, cid)
    programStore.onUpdate = this.updateRoot(name)
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
    return this.store.put(value)
  }

  async get<T>(cid: CID, checkFn: (obj: unknown) => T): Promise<T> {
    return this.store.get(cid, checkFn)
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
      await this.store.putBytes(block.cid, block.bytes)
    }
    this.cid = rootCid
    const root = await this.getRoot()
    this.did = root.did
    this.programCids = root.programs
    this.programs = {}
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
    await this.store.addToCar(car, this.cid)
    const commit = await this.store.get(this.cid, check.assureCommit)
    await this.store.addToCar(car, commit.root)
    await Promise.all(
      Object.values(this.programCids).map(async (cid) => {
        const programStore = await ProgramStore.load(this.store, cid)
        await programStore.writeToCarStream(car)
      }),
    )
  }

  async writeCommitsToCarStream(
    car: BlockWriter,
    from: CID,
    to: CID | null,
  ): Promise<void> {
    const commit = await this.store.get(from, check.assureCommit)
    const { added, prev } = await this.store.get(
      commit.root,
      check.assureUserRoot,
    )
    await this.store.addToCar(car, this.cid)
    await this.store.addToCar(car, commit.root)

    await Promise.all(added.map((cid) => this.store.addToCar(car, cid)))
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

export default UserStore

import { CID } from 'multiformats/cid'
import UserStore from './index.js'
import ProgramStore from './program-store'

export class Program {
  name: string
  store: UserStore

  constructor(name: string, store: UserStore) {
    this.name = name
    this.store = store
  }

  getCid(): CID {
    return this.store.cid
  }

  async runOnProgram<T>(fn: (store: ProgramStore) => Promise<T>): Promise<T> {
    return this.store.runOnProgram(this.name, fn)
  }
}

export default Program

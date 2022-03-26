import { CID } from 'multiformats/cid'
import Repo from './index.js'
import ProgramStore from './program-store'

export class Program {
  name: string
  repo: Repo

  constructor(name: string, repo: Repo) {
    this.name = name
    this.repo = repo
  }

  getCid(): CID {
    return this.repo.cid
  }

  async runOnProgram<T>(fn: (program: ProgramStore) => Promise<T>): Promise<T> {
    return this.repo.runOnProgram(this.name, fn)
  }
}

export default Program

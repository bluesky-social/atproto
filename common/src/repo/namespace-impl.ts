import { CID } from 'multiformats/cid'
import Repo from './index.js'
import Namespace from './namespace'

export class NamespaceImpl {
  name: string
  repo: Repo

  constructor(name: string, repo: Repo) {
    this.name = name
    this.repo = repo
  }

  getCid(): CID {
    return this.repo.cid
  }

  async runOnNamespace<T>(
    fn: (namespace: Namespace) => Promise<T>,
  ): Promise<T> {
    return this.repo.runOnNamespace(this.name, fn)
  }
}

export default NamespaceImpl

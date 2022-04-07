import { CID } from 'multiformats/cid'
import Repo from './index.js'
import Namespace from './namespace'

export class NamespaceImpl {
  namespace: string
  repo: Repo

  constructor(namespace: string, repo: Repo) {
    this.namespace = namespace
    this.repo = repo
  }

  getCid(): CID {
    return this.repo.cid
  }

  async runOnNamespace<T>(
    fn: (namespace: Namespace) => Promise<T>,
  ): Promise<T> {
    return this.repo.runOnNamespace(this.namespace, fn)
  }
}

export default NamespaceImpl

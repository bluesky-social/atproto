import { once } from 'node:events'
import { Etcd3, Watcher } from 'etcd3'

/**
 * A reactive map based on the keys and values stored within etcd under a given prefix.
 */
export class EtcdMap {
  inner = new Map<string, VersionedValue>()
  watcher: Watcher
  connecting: Promise<void> | undefined
  handlers: ((self: EtcdMap) => void)[] = []

  constructor(
    private etcd: Etcd3,
    private prefix = '',
  ) {
    this.watcher = etcd.watch().prefix(prefix).watcher()
    this.connecting = connectWatcher(this.watcher)
  }

  async connect() {
    this.watcher.on('put', (kv) => {
      const key = kv.key.toString()
      const value = kv.value.toString()
      const rev = revToInt(kv.mod_revision)
      this.apply(key, { value, rev })
    })
    this.watcher.on('delete', (kv) => {
      const key = kv.key.toString()
      const value = null
      const rev = revToInt(kv.mod_revision)
      this.apply(key, { value, rev })
    })
    await this.connecting?.finally(() => {
      this.connecting = undefined
    })
    const { kvs } = await this.etcd.getAll().prefix(this.prefix).exec()
    for (const kv of kvs) {
      const key = kv.key.toString()
      const value = kv.value.toString()
      const rev = revToInt(kv.mod_revision)
      this.apply(key, { value, rev })
    }
  }

  get(key: string) {
    return this.inner.get(key)?.value ?? null
  }

  *values() {
    for (const { value } of this.inner.values()) {
      if (value !== null) {
        yield value
      }
    }
  }

  onUpdate(handler: (self: EtcdMap) => void) {
    this.handlers.push(handler)
  }

  private update() {
    for (const handler of this.handlers) {
      handler(this)
    }
  }

  private apply(key, vv: VersionedValue) {
    const curr = this.inner.get(key)
    if (curr && curr.rev > vv.rev) return
    this.inner.set(key, vv)
    this.update()
  }
}

function revToInt(rev: string) {
  return parseInt(rev, 10)
}

async function connectWatcher(watcher: Watcher) {
  await Promise.race([
    once(watcher, 'connected'),
    once(watcher, 'error').then((err) => Promise.reject(err)),
  ])
}

type VersionedValue = {
  rev: number
  value: string | null
}

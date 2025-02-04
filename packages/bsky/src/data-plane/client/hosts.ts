import { Etcd3 } from 'etcd3'
import { EtcdMap } from '../../etcd'
import { dataplaneLogger as logger } from '../../logger'

export interface HostList {
  get: () => Iterable<string>
  onUpdate(handler: HostListHandler): void
}

type HostListHandler = (hosts: Iterable<string>) => void

export class BasicHostList implements HostList {
  private hosts: Iterable<string>
  private handlers: HostListHandler[] = []

  constructor(hosts: Iterable<string>) {
    this.hosts = hosts
  }

  get() {
    return this.hosts
  }

  set(hosts: Iterable<string>) {
    this.hosts = hosts
    this.update()
  }

  update() {
    for (const handler of this.handlers) {
      handler(this.hosts)
    }
  }

  onUpdate(handler: HostListHandler) {
    this.handlers.push(handler)
  }
}

export class EtcdHostList implements HostList {
  private kv: EtcdMap
  private inner = new BasicHostList(new Set())
  private fallback: Set<string>

  constructor(
    private etcd: Etcd3,
    private prefix: string,
    fallback?: string[],
  ) {
    this.fallback = new Set(fallback)
    this.kv = new EtcdMap(this.etcd, this.prefix)
    this.kv.watcher.on('connected', (res) => {
      logger.warn(
        { watcherId: this.kv.watcher.id, header: res.header },
        'EtcdHostList connected',
      )
    })
    this.kv.watcher.on('disconnected', (err) => {
      logger.warn(
        { watcherId: this.kv.watcher.id, err },
        'EtcdHostList disconnected',
      )
    })
    this.kv.watcher.on('error', (err) => {
      logger.error({ watcherId: this.kv.watcher.id, err }, 'EtcdHostList error')
    })
  }

  async connect() {
    await this.kv.connect()
    this.update()
    this.kv.onUpdate(() => this.update())
  }

  get() {
    return this.inner.get()
  }

  update() {
    const hosts = new Set<string>()
    for (const host of this.kv.values()) {
      if (URL.canParse(host)) {
        hosts.add(host)
      }
    }
    if (hosts.size) {
      this.inner.set(hosts)
    } else if (this.fallback.size) {
      this.inner.set(this.fallback)
    }
  }

  onUpdate(handler: HostListHandler) {
    this.inner.onUpdate(handler)
  }
}

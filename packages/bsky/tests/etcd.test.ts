import EventEmitter from 'node:events'
import { Etcd3, IKeyValue } from 'etcd3'
import { EtcdHostList } from '../src'
import { EtcdMap } from '../src/etcd'

describe('etcd', () => {
  describe('EtcdMap', () => {
    it('initializes values based on current keys', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: '1' })
      etcd.watcher.set('service/b', { value: '2' })
      etcd.watcher.set('service/c', { value: '3' })
      const map = new EtcdMap(etcd as unknown as Etcd3)
      await map.connect()
      expect(map.get('service/a')).toBe('1')
      expect(map.get('service/b')).toBe('2')
      expect(map.get('service/c')).toBe('3')
      expect([...map.values()]).toEqual(['1', '2', '3'])
    })

    it('maintains key updates', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: '1' })
      etcd.watcher.set('service/b', { value: '2' })
      etcd.watcher.set('service/c', { value: '3' })
      const map = new EtcdMap(etcd as unknown as Etcd3)
      await map.connect()
      etcd.watcher.set('service/b', { value: '4' })
      expect(map.get('service/a')).toBe('1')
      expect(map.get('service/b')).toBe('4')
      expect(map.get('service/c')).toBe('3')
      expect([...map.values()]).toEqual(['1', '4', '3'])
    })

    it('maintains key creates', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: '1' })
      const map = new EtcdMap(etcd as unknown as Etcd3)
      await map.connect()
      etcd.watcher.set('service/b', { value: '2' })
      expect(map.get('service/a')).toBe('1')
      expect(map.get('service/b')).toBe('2')
      expect([...map.values()]).toEqual(['1', '2'])
    })

    it('maintains key deletions', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: '1' })
      etcd.watcher.set('service/b', { value: '2' })
      const map = new EtcdMap(etcd as unknown as Etcd3)
      await map.connect()
      etcd.watcher.del('service/b')
      expect(map.get('service/a')).toBe('1')
      expect(map.get('service/b')).toBe(null)
      expect([...map.values()]).toEqual(['1'])
    })

    it('notifies of updates', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: '1' })
      etcd.watcher.set('service/b', { value: '2' })
      const map = new EtcdMap(etcd as unknown as Etcd3)
      await map.connect()
      const states: string[][] = [[...map.values()]]
      map.onUpdate((update) => {
        states.push([...update.values()])
      })
      etcd.watcher.set('service/c', { value: '3' })
      etcd.watcher.del('service/b')
      etcd.watcher.set('service/a', { value: '4' })
      expect(states).toEqual([
        ['1', '2'],
        ['1', '2', '3'],
        ['1', '3'],
        ['4', '3'],
      ])
    })

    it('ignores out-of-order updates', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: '1' })
      const map = new EtcdMap(etcd as unknown as Etcd3)
      await map.connect()
      const states: string[][] = [[...map.values()]]
      map.onUpdate((update) => {
        states.push([...update.values()])
      })
      etcd.watcher.set('service/a', { value: '2' })
      etcd.watcher.set('service/a', { value: '3', overrideRev: 1 }) // old rev
      etcd.watcher.set('service/a', { value: '4' })
      expect(map.get('service/a')).toBe('4')
      expect(states).toEqual([['1'], ['2'], ['4']]) // never witnessed 3
    })
  })

  describe('EtcdHostList', () => {
    it('initializes values based on current keys', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: 'http://192.168.1.1' })
      etcd.watcher.set('service/b', { value: 'http://192.168.1.2' })
      etcd.watcher.set('service/c', { value: 'http://192.168.1.3' })
      const hostList = new EtcdHostList(etcd as unknown as Etcd3, '')
      await hostList.connect()
      expect([...hostList.get()]).toEqual([
        'http://192.168.1.1',
        'http://192.168.1.2',
        'http://192.168.1.3',
      ])
    })

    it('maintains key updates', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: 'http://192.168.1.1' })
      etcd.watcher.set('service/b', { value: 'http://192.168.1.2' })
      etcd.watcher.set('service/c', { value: 'http://192.168.1.3' })
      const hostList = new EtcdHostList(etcd as unknown as Etcd3, '')
      await hostList.connect()
      etcd.watcher.set('service/b', { value: 'http://192.168.1.4' })
      expect([...hostList.get()]).toEqual([
        'http://192.168.1.1',
        'http://192.168.1.4',
        'http://192.168.1.3',
      ])
    })

    it('maintains key creates', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: 'http://192.168.1.1' })
      const hostList = new EtcdHostList(etcd as unknown as Etcd3, '')
      await hostList.connect()
      etcd.watcher.set('service/b', { value: 'http://192.168.1.2' })
      expect([...hostList.get()]).toEqual([
        'http://192.168.1.1',
        'http://192.168.1.2',
      ])
    })

    it('maintains key deletions', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: 'http://192.168.1.1' })
      etcd.watcher.set('service/b', { value: 'http://192.168.1.2' })
      const hostList = new EtcdHostList(etcd as unknown as Etcd3, '')
      await hostList.connect()
      etcd.watcher.del('service/b')
      expect([...hostList.get()]).toEqual(['http://192.168.1.1'])
    })

    it('notifies of updates', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: 'http://192.168.1.1' })
      etcd.watcher.set('service/b', { value: 'http://192.168.1.2' })
      const hostList = new EtcdHostList(etcd as unknown as Etcd3, '')
      await hostList.connect()
      const states: string[][] = [[...hostList.get()]]
      hostList.onUpdate((updated) => {
        expect([...updated]).toEqual([...hostList.get()])
        states.push([...updated])
      })
      etcd.watcher.set('service/c', { value: 'http://192.168.1.3' })
      etcd.watcher.del('service/b')
      etcd.watcher.set('service/a', { value: 'http://192.168.1.4' })
      expect(states).toEqual([
        ['http://192.168.1.1', 'http://192.168.1.2'],
        ['http://192.168.1.1', 'http://192.168.1.2', 'http://192.168.1.3'],
        ['http://192.168.1.1', 'http://192.168.1.3'],
        ['http://192.168.1.4', 'http://192.168.1.3'],
      ])
    })

    it('ignores bad host values', async () => {
      const etcd = new MockEtcd()
      etcd.watcher.set('service/a', { value: 'not-a-host' })
      etcd.watcher.set('service/b', { value: 'http://192.168.1.2' })
      const hostList = new EtcdHostList(etcd as unknown as Etcd3, '')
      await hostList.connect()
      expect([...hostList.get()]).toEqual(['http://192.168.1.2'])
      etcd.watcher.set('service/a', { value: 'http://192.168.1.1' })
      etcd.watcher.set('service/c', { value: 'not-a-host' })
      expect([...hostList.get()]).toEqual([
        'http://192.168.1.1',
        'http://192.168.1.2',
      ])
      etcd.watcher.set('service/c', { value: 'http://192.168.1.3' })
      expect([...hostList.get()]).toEqual([
        'http://192.168.1.1',
        'http://192.168.1.2',
        'http://192.168.1.3',
      ])
    })

    it('falls back to static host list when uninitialized or no keys available', async () => {
      const etcd = new MockEtcd()
      const hostList = new EtcdHostList(etcd as unknown as Etcd3, '', [
        'http://10.0.0.1',
        'http://10.0.0.2',
      ])
      etcd.watcher.set('service/a', { value: 'http://192.168.1.1' })
      expect([...hostList.get()]).toEqual([
        'http://10.0.0.1',
        'http://10.0.0.2',
      ])
      await hostList.connect()
      const states: string[][] = [[...hostList.get()]]
      hostList.onUpdate((updated) => {
        states.push([...updated])
      })
      etcd.watcher.del('service/a')
      etcd.watcher.set('service/b', { value: 'http://192.168.1.2' })
      expect(states).toEqual([
        ['http://192.168.1.1'],
        ['http://10.0.0.1', 'http://10.0.0.2'],
        ['http://192.168.1.2'],
      ])
    })
  })
})

class MockEtcd {
  public watcher = new MockWatcher()
  watch() {
    const watcher = this.watcher
    return {
      prefix() {
        return {
          watcher() {
            return watcher
          },
        }
      },
    }
  }
  getAll() {
    const watcher = this.watcher
    return {
      prefix() {
        return {
          async exec(): Promise<{ kvs: IKeyValue[] }> {
            return { kvs: watcher.getAll() }
          },
        }
      },
    }
  }
}

class MockWatcher extends EventEmitter {
  rev = 1
  kvs: IKeyValue[] = []
  constructor() {
    super()
    process.nextTick(() => this.emit('connected', {}))
  }
  get(key: string): IKeyValue | null {
    const found = this.kvs.find((kv) => kv.key.toString() === key)
    return found ?? null
  }
  getAll(): IKeyValue[] {
    return [...this.kvs]
  }
  set(
    key: string,
    { value, overrideRev }: { value: string; overrideRev?: number },
  ) {
    const found = this.kvs.find((kv) => kv.key.toString() === key)
    const rev = overrideRev ?? ++this.rev
    if (found) {
      found.value = Buffer.from(value)
      found.mod_revision = rev.toString()
      found.version = (parseInt(found.version, 10) + 1).toString()
      this.emit('put', found)
    } else {
      const created = {
        key: Buffer.from(key),
        value: Buffer.from(value),
        create_revision: rev.toString(),
        mod_revision: rev.toString(),
        version: '1',
        lease: '0',
      }
      this.kvs.push(created)
      this.emit('put', created)
    }
  }
  del(key: string) {
    const foundIdx = this.kvs.findIndex((kv) => kv.key.toString() === key)
    if (foundIdx === -1) return
    const [deleted] = this.kvs.splice(foundIdx, 1)
    const rev = ++this.rev
    deleted.value = Buffer.from('')
    deleted.mod_revision = rev.toString()
    deleted.create_revision = '0'
    deleted.version = '0'
    this.emit('delete', deleted)
  }
  on(evt: 'connected', listener: (res: unknown) => void): any
  on(evt: 'put', listener: (kv: IKeyValue) => void): any
  on(evt: 'delete', listener: (kv: IKeyValue) => void): any
  on(evt: string, listener: (...args: any[]) => void) {
    super.on(evt, listener)
  }
}

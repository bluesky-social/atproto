import assert from 'assert'
import { Redis as RedisDriver } from 'ioredis'

export class Redis {
  driver: RedisDriver
  namespace?: string
  constructor(opts: RedisOptions) {
    if ('sentinel' in opts) {
      assert(opts.sentinel && Array.isArray(opts.hosts) && opts.hosts.length)
      this.driver = new RedisDriver({
        name: opts.sentinel,
        sentinels: opts.hosts.map(addressParts),
      })
    } else if ('url' in opts) {
      assert(opts.url)
      this.driver = new RedisDriver(opts.url)
    } else {
      this.driver = opts.driver
    }
    this.namespace = opts.namespace
  }

  async readStreams(
    streams: StreamRef[],
    opts: { count: number; blockMs?: number },
  ) {
    const allRead = await this.driver.xreadBuffer(
      'COUNT',
      opts.count, // events per stream
      'BLOCK',
      opts.blockMs ?? 1000, // millis
      'STREAMS',
      ...streams.map((s) => this.ns(s.key)),
      ...streams.map((s) => s.cursor),
    )
    const results: StreamOutput[] = []
    for (const [key, messages] of allRead ?? []) {
      const result: StreamOutput = {
        key: this.rmns(key.toString()),
        messages: [],
      }
      results.push(result)
      for (const [seqBuf, values] of messages) {
        const message = { cursor: seqBuf.toString(), contents: {} }
        result.messages.push(message)
        for (let i = 0; i < values.length; ++i) {
          if (i % 2 === 0) continue
          const field = values[i - 1].toString()
          message.contents[field] = values[i]
        }
      }
    }
    return results
  }

  async addToStream(
    key: string,
    seq: number | string,
    vals: [key: string, value: string | Buffer][],
  ) {
    await this.driver.xadd(this.ns(key), seq, ...vals.flat())
  }

  async trimStream(key: string, cursor: number | string) {
    await this.driver.xtrim(this.ns(key), 'MINID', cursor)
  }

  async streamLengths(keys: string[]) {
    const pipeline = this.driver.pipeline()
    for (const key of keys) {
      pipeline.xlen(this.ns(key))
    }
    const results = await pipeline.exec()
    return (results ?? []).map(([, len = 0]) => Number(len))
  }

  async get(key: string) {
    return await this.driver.get(this.ns(key))
  }

  async set(key: string, val: string | number) {
    await this.driver.set(this.ns(key), val)
  }

  async del(key: string) {
    return await this.driver.del(this.ns(key))
  }

  async destroy() {
    await this.driver.quit()
  }

  // namespace redis keys
  ns(key: string) {
    return this.namespace ? `${this.namespace}:${key}` : key
  }

  // remove namespace from redis key
  rmns(key: string) {
    return this.namespace && key.startsWith(`${this.namespace}:`)
      ? key.replace(`${this.namespace}:`, '')
      : key
  }
}

type StreamRef = { key: string; cursor: string | number }

type StreamOutput = {
  key: string
  messages: { cursor: string; contents: Record<string, Buffer | undefined> }[]
}

export type RedisOptions = (
  | { driver: RedisDriver }
  | { url: string }
  | { sentinel: string; hosts: string[] }
) & {
  namespace?: string
}

function addressParts(addr: string): { host: string; port: number } {
  const [host, portStr = '26379', ...others] = addr.split(':')
  const port = parseInt(portStr, 10)
  assert(host && !isNaN(port) && !others.length, `Invalid address: ${addr}`)
  return { host, port }
}

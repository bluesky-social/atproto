import assert from 'node:assert'
import { Redis as RedisDriver } from 'ioredis'

export class Redis {
  driver: RedisDriver
  namespace?: string
  constructor(opts: RedisOptions) {
    if ('sentinel' in opts) {
      assert(opts.sentinel && Array.isArray(opts.hosts) && opts.hosts.length)
      this.driver = new RedisDriver({
        name: opts.sentinel,
        sentinels: opts.hosts.map((h) => addressParts(h, 26379)),
        password: opts.password,
        db: opts.db,
        commandTimeout: opts.commandTimeout,
      })
    } else if ('host' in opts) {
      assert(opts.host)
      this.driver = new RedisDriver({
        ...addressParts(opts.host),
        password: opts.password,
        db: opts.db,
        commandTimeout: opts.commandTimeout,
      })
    } else {
      assert(opts.driver)
      this.driver = opts.driver
    }
    this.namespace = opts.namespace
  }

  withNamespace(namespace: string): Redis {
    return new Redis({ driver: this.driver, namespace })
  }

  async readStreams(
    streams: StreamRef[],
    opts: { count: number; blockMs?: number },
  ) {
    const read = await this.driver.xread(
      'COUNT',
      opts.count, // events per stream
      'BLOCK',
      opts.blockMs ?? 1000, // millis
      'STREAMS',
      ...streams.map((s) => this.ns(s.key)),
      ...streams.map((s) => s.cursor),
    )
    return this.formatStreamOutput(read)
  }

  async readConsumerGroup(
    stream: StreamRef,
    opts: { count: number; group: string; consumer: string; blockMs?: number },
  ) {
    const read = await this.driver.xreadgroup(
      'GROUP',
      opts.group,
      opts.consumer,
      'COUNT',
      opts.count, // events per stream
      'BLOCK',
      opts.blockMs ?? 1000, // millis
      'STREAMS',
      this.ns(stream.key),
      stream.cursor,
    )
    return this.formatStreamOutput(read as StreamRead).flatMap(
      (out) => out.messages,
    )
  }

  async ensureConsumerGroup(opts: { group: string; stream: string }) {
    try {
      await this.driver.xgroup(
        'CREATE',
        opts.stream,
        opts.group,
        '0',
        'MKSTREAM',
      )
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('BUSYGROUP')) {
        // noop
      } else {
        throw err
      }
    }
  }

  async ackMessage(opts: {
    group: string
    stream: string
    id: string
    del?: boolean
  }) {
    const pipeline = this.driver.pipeline()
    pipeline.xack(opts.stream, opts.group, opts.id)
    if (opts.del) {
      pipeline.xdel(opts.stream, opts.id)
    }
    await pipeline.exec()
  }

  async addToStream(
    key: string,
    id: number | string,
    fields: [key: string, value: string | Buffer][],
  ) {
    await this.driver.xadd(this.ns(key), id, ...fields.flat())
  }

  async addMultiToStream(
    evts: {
      key: string
      id: number | string
      fields: [key: string, value: string | Buffer][]
    }[],
  ) {
    const pipeline = this.driver.pipeline()
    for (const { key, id, fields } of evts) {
      pipeline.xadd(this.ns(key), id, ...fields.flat())
    }
    return (await pipeline.exec()) ?? []
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

  async set(key: string, val: string | number, ttlMs?: number) {
    if (ttlMs !== undefined) {
      await this.driver.set(this.ns(key), val, 'PX', ttlMs)
    } else {
      await this.driver.set(this.ns(key), val)
    }
  }

  async getMulti(keys: string[]) {
    const namespaced = keys.map((k) => this.ns(k))
    const got = await this.driver.mget(...namespaced)
    const results = {}
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      results[key] = got[i]
    }
    return results
  }

  async setMulti(vals: Record<string, string | number>, ttlMs?: number) {
    if (Object.keys(vals).length === 0) {
      return
    }
    let builder = this.driver.multi({ pipeline: true })
    for (const key of Object.keys(vals)) {
      if (ttlMs !== undefined) {
        builder = builder.set(this.ns(key), vals[key], 'PX', ttlMs)
      } else {
        builder = builder.set(this.ns(key), vals[key])
      }
    }
    await builder.exec()
  }

  async del(key: string) {
    return await this.driver.del(this.ns(key))
  }

  async expire(key: string, seconds: number) {
    return await this.driver.expire(this.ns(key), seconds)
  }

  async zremrangebyscore(key: string, min: number, max: number) {
    return await this.driver.zremrangebyscore(this.ns(key), min, max)
  }

  async zcount(key: string, min: number, max: number) {
    return await this.driver.zcount(this.ns(key), min, max)
  }

  async zadd(key: string, score: number, member: number | string) {
    return await this.driver.zadd(this.ns(key), score, member)
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

  private formatStreamOutput(read: StreamRead) {
    const results: StreamOutput[] = []
    for (const [key, messages] of read ?? []) {
      const result: StreamOutput = {
        key: this.rmns(key),
        messages: [],
      }
      results.push(result)
      for (const [cursor, values] of messages) {
        const message: StreamOutputMessage = { cursor, contents: {} }
        result.messages.push(message)
        if (!values) continue // may be null
        for (let i = 0; i < values.length; ++i) {
          if (i % 2 === 0) continue
          const field = values[i - 1]
          message.contents[field] = values[i]
        }
      }
    }
    return results
  }
}

type StreamRef = { key: string; cursor: string | number }

export type StreamOutput = {
  key: string
  messages: StreamOutputMessage[]
}

export type StreamOutputMessage = {
  cursor: string
  contents: Record<string, string>
}

export type RedisOptions = (
  | { driver: RedisDriver }
  | { host: string }
  | { sentinel: string; hosts: string[] }
) & {
  password?: string
  namespace?: string
  db?: number
  commandTimeout?: number
}

export function addressParts(
  addr: string,
  defaultPort = 6379,
): { host: string; port: number } {
  const [host, portStr, ...others] = addr.split(':')
  const port = portStr ? parseInt(portStr, 10) : defaultPort
  assert(host && !isNaN(port) && !others.length, `invalid address: ${addr}`)
  return { host, port }
}

type StreamRead = Awaited<ReturnType<InstanceType<typeof RedisDriver>['xread']>>

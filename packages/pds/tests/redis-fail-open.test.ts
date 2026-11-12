import { once } from 'node:events'
import net from 'node:net'
import type { Redis } from 'ioredis'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { REDIS_COMMAND_TIMEOUT_MS, getRedisClient } from '../src/redis.js'
import { FailOpenReplayStore } from '../src/replay-store.js'

// A Redis that completes the client's handshake (its INFO ready check) and
// then never answers another command: the case a timeout has to cover.
async function hungRedis() {
  const sockets = new Set<net.Socket>()
  const info = '# Server\r\nredis_version:7.4.1\r\n'
  const server = net.createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('data', (data) => {
      if (data.toString().toLowerCase().includes('info')) {
        socket.write(`$${Buffer.byteLength(info)}\r\n${info}\r\n`)
      }
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as net.AddressInfo
  return {
    address: `127.0.0.1:${port}`,
    close: async () => {
      for (const s of sockets) s.destroy()
      server.close()
      await once(server, 'close')
    },
  }
}

describe('scratch redis failures fail open', () => {
  describe('FailOpenReplayStore', () => {
    it('checks nonces in process memory when redis fails', async () => {
      const failing = {
        set: async () => {
          throw new Error('connection refused')
        },
      } as unknown as Redis
      const store = new FailOpenReplayStore(failing)
      expect(await store.unique('dpop', 'a', 60_000)).toBe(true)
      expect(await store.unique('dpop', 'a', 60_000)).toBe(false)
      expect(await store.unique('dpop', 'b', 60_000)).toBe(true)
    })

    it('refuses a replay to the same process across redis failing and recovering', async () => {
      let up = true
      const seen = new Set<string>()
      const flaky = {
        set: async (key: string) => {
          if (!up) throw new Error('connection refused')
          const prev = seen.has(key) ? '1' : null
          seen.add(key)
          return prev
        },
      } as unknown as Redis
      const store = new FailOpenReplayStore(flaky)
      expect(await store.unique('dpop', 'before', 60_000)).toBe(true)
      up = false
      expect(await store.unique('dpop', 'before', 60_000)).toBe(false)
      expect(await store.unique('dpop', 'during', 60_000)).toBe(true)
      up = true
      expect(await store.unique('dpop', 'during', 60_000)).toBe(false)
    })

    it('uses redis while it answers, under the keys ReplayStoreRedis used', async () => {
      const seen = new Set<string>()
      const working = {
        set: async (key: string) => {
          const prev = seen.has(key) ? '1' : null
          seen.add(key)
          return prev
        },
      } as unknown as Redis
      const store = new FailOpenReplayStore(working)
      expect(await store.unique('dpop', 'a', 60_000)).toBe(true)
      expect(await store.unique('dpop', 'a', 60_000)).toBe(false)
      expect([...seen]).toEqual(['nonces:dpop:a'])
    })
  })

  it('the scratch client fails a command on a hung redis within its timeout', async () => {
    const redis = await hungRedis()
    const client = getRedisClient(redis.address)
    try {
      await once(client, 'ready')
      const start = Date.now()
      await expect(client.get('k')).rejects.toThrow(/timed out/i)
      expect(Date.now() - start).toBeLessThan(REDIS_COMMAND_TIMEOUT_MS * 3)
    } finally {
      client.disconnect()
      await redis.close()
    }
  })

  it('the scratch client fails a command at once when redis is unreachable', async () => {
    const redis = await hungRedis()
    const address = redis.address
    await redis.close()
    const client = getRedisClient(address)
    try {
      const start = Date.now()
      await expect(client.get('k')).rejects.toThrow()
      expect(Date.now() - start).toBeLessThan(REDIS_COMMAND_TIMEOUT_MS)
    } finally {
      client.disconnect()
    }
  })

  describe('a PDS whose redis hangs', () => {
    let redis: Awaited<ReturnType<typeof hungRedis>>
    let network: TestNetworkNoAppView

    beforeAll(async () => {
      redis = await hungRedis()
      network = await TestNetworkNoAppView.create({
        dbPostgresSchema: 'redis_fail_open',
        pds: { redisScratchAddress: redis.address, rateLimitsEnabled: true },
      })
    })

    afterAll(async () => {
      await network?.close()
      await redis?.close()
    })

    it('still creates accounts, writes and serves reads', async () => {
      const sc = network.getSeedClient()
      const alice = await sc.createAccount('alice', {
        handle: 'alice.test',
        email: 'alice@test.com',
        password: 'alice-pass',
      })
      await sc.post(alice.did, 'written while redis hangs')
      const res = await network.pds
        .getAgent()
        .api.com.atproto.server.describeServer()
      expect(res.success).toBe(true)
    })
  })
})

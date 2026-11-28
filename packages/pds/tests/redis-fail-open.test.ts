import { once } from 'node:events'
import net from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { REDIS_COMMAND_TIMEOUT_MS, getRedisClient } from '../src/redis.js'

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

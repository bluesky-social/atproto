import { createSocket } from 'node:dgram'
import type { LookupAddress, LookupOptions } from 'node:dns'
import { Resolver } from 'node:dns/promises'
import type { AddressInfo, LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import { describe, expect, it } from 'vitest'
import { createResolverLookup } from './lookup.js'

const A = 1
const AAAA = 28

/**
 * The records of a name, by query type. A type without records gets an empty
 * answer (ENODATA); one mapped to `'silent'` gets no answer at all. A name
 * missing from the zone doesn't exist (ENOTFOUND).
 */
type Zone = Record<
  string,
  { A?: string[] | 'silent'; AAAA?: string[] | 'silent' }
>

/**
 * A nameserver answering from {@link zone}, for a {@link Resolver} that
 * queries it alone, once, and gives up after 100ms.
 */
async function startNameserver(zone: Zone) {
  const socket = createSocket('udp4')
  const queries: string[] = []

  socket.on('message', (query, remote) => {
    // Header (12 bytes), then the question: labels, type and class
    let end = 12
    const labels: string[] = []
    while (query[end] !== 0) {
      labels.push(query.toString('latin1', end + 1, end + 1 + query[end]))
      end += 1 + query[end]
    }
    const type = query.readUInt16BE(end + 1)
    end += 5

    const name = labels.join('.').toLowerCase()
    const typeName = type === A ? 'A' : type === AAAA ? 'AAAA' : String(type)
    queries.push(`${typeName} ${name}`)

    const records = zone[name]?.[typeName as 'A' | 'AAAA']
    if (records === 'silent') return

    const answers = (records ?? []).map((address) => {
      const rdata = Buffer.from(ipaddr.parse(address).toByteArray())
      const rr = Buffer.alloc(12)
      rr.writeUInt16BE(0xc00c, 0) // Pointer to the question's name
      rr.writeUInt16BE(type, 2)
      rr.writeUInt16BE(1, 4) // IN
      rr.writeUInt32BE(60, 6) // TTL
      rr.writeUInt16BE(rdata.length, 10)
      return Buffer.concat([rr, rdata])
    })

    const header = Buffer.alloc(12)
    query.copy(header, 0, 0, 2) // ID
    // QR, RD and RA, with NXDOMAIN for a name missing from the zone
    header.writeUInt16BE(0x8180 | (zone[name] ? 0 : 3), 2)
    header.writeUInt16BE(1, 4)
    header.writeUInt16BE(answers.length, 6)

    socket.send(
      Buffer.concat([header, query.subarray(12, end), ...answers]),
      remote.port,
      remote.address,
    )
  })

  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve))
  const { port } = socket.address() as AddressInfo

  const resolver = new Resolver({ timeout: 100, tries: 1 })
  resolver.setServers([`127.0.0.1:${port}`])

  return {
    queries,
    lookup: createResolverLookup(resolver),
    [Symbol.asyncDispose]: async () => {
      resolver.cancel()
      await new Promise<void>((resolve) => socket.close(resolve))
    },
  }
}

function lookupAsync(
  lookup: LookupFunction,
  hostname: string,
  options: LookupOptions,
) {
  return new Promise<{ address: string | LookupAddress[]; family?: number }>(
    (resolve, reject) => {
      lookup(hostname, options, (err, address, family) => {
        if (err) reject(err)
        else resolve({ address, family })
      })
    },
  )
}

describe(createResolverLookup, () => {
  const zone: Zone = {
    'dual.com': { A: ['192.0.2.1'], AAAA: ['2001:db8::1'] },
    'ipv6.com': { AAAA: ['2001:db8::1'] },
    'empty.com': {},
    'slow-ipv4.com': { A: 'silent' },
    'slow.com': { A: 'silent', AAAA: 'silent' },
  }

  it('resolves every address, IPv4 first', async () => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, 'dual.com', { all: true }),
    ).resolves.toEqual({
      address: [
        { address: '192.0.2.1', family: 4 },
        { address: '2001:db8::1', family: 6 },
      ],
    })
  })

  it('resolves the first address unless asked for all', async () => {
    await using ns = await startNameserver(zone)

    await expect(lookupAsync(ns.lookup, 'dual.com', {})).resolves.toEqual({
      address: '192.0.2.1',
      family: 4,
    })
  })

  it.each([
    [4, 'A dual.com', '192.0.2.1'],
    ['IPv4', 'A dual.com', '192.0.2.1'],
    [6, 'AAAA dual.com', '2001:db8::1'],
    ['IPv6', 'AAAA dual.com', '2001:db8::1'],
  ] as const)('only queries the family %j', async (family, query, address) => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, 'dual.com', { family, all: true }),
    ).resolves.toEqual({
      address: [{ address, family: address.includes(':') ? 6 : 4 }],
    })
    expect(ns.queries).toEqual([query])
  })

  it('resolves a name with IPv6 addresses only', async () => {
    await using ns = await startNameserver(zone)

    await expect(lookupAsync(ns.lookup, 'ipv6.com', {})).resolves.toEqual({
      address: '2001:db8::1',
      family: 6,
    })
  })

  it('fails with ENOTFOUND for a name that does not exist', async () => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, 'missing.com', { all: true }),
    ).rejects.toMatchObject({ code: 'ENOTFOUND' })
  })

  it('fails with ENODATA for a name without addresses', async () => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, 'empty.com', { all: true }),
    ).rejects.toMatchObject({ code: 'ENODATA' })
  })

  it("reports why a query failed rather than the other family's ENODATA", async () => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, 'slow-ipv4.com', { all: true }),
    ).rejects.toMatchObject({ code: 'ETIMEOUT' })
  })

  it('gives up on a nameserver that does not answer', async () => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, 'slow.com', { all: true }),
    ).rejects.toMatchObject({ code: 'ETIMEOUT' })
    expect(ns.queries).toEqual(['A slow.com', 'AAAA slow.com'])
  })

  it('queries the nameserver rather than /etc/hosts', async () => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, 'localhost', { all: true }),
    ).rejects.toMatchObject({ code: 'ENOTFOUND' })
    expect(ns.queries).toEqual(['A localhost', 'AAAA localhost'])
  })

  it.each([
    ['192.0.2.1', 4],
    ['2001:db8::1', 6],
  ])('resolves the IP literal %s to itself', async (address, family) => {
    await using ns = await startNameserver(zone)

    await expect(
      lookupAsync(ns.lookup, address, { all: true }),
    ).resolves.toEqual({ address: [{ address, family }] })
    await expect(
      lookupAsync(ns.lookup, address, { family: family === 4 ? 6 : 4 }),
    ).rejects.toMatchObject({ code: 'ENOTFOUND' })
    expect(ns.queries).toEqual([])
  })
})

import { createSocket } from 'node:dgram'
import dns, { type LookupAddress, type LookupOptions } from 'node:dns'
import { Resolver } from 'node:dns/promises'
import type { AddressInfo, LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'
import { describe, expect, it, vi } from 'vitest'
import { createLimitedLookup, createResolverLookup } from './lookup.js'

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

  // `dns.lookup` folds getaddrinfo's EAI_NODATA into ENOTFOUND, the only code
  // error classifiers know for a host without addresses.
  it.each([
    ['empty.com', {}],
    ['ipv6.com', { family: 4 }],
  ] as const)(
    'fails with ENOTFOUND for %s, which has no addresses (%j)',
    async (hostname, options) => {
      await using ns = await startNameserver(zone)

      await expect(
        lookupAsync(ns.lookup, hostname, { ...options, all: true }),
      ).rejects.toMatchObject({
        code: 'ENOTFOUND',
        message: `getaddrinfo ENOTFOUND ${hostname}`,
      })
    },
  )

  it('reports why a query failed rather than the lack of addresses', async () => {
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

/**
 * A lookup whose calls complete when the test says so.
 */
function heldLookup() {
  const calls: {
    hostname: string
    complete: (address: string) => void
  }[] = []
  const lookup = vi.fn<LookupFunction>((hostname, options, callback) => {
    calls.push({
      hostname,
      complete: (address) => {
        if (options.all) callback(null, [{ address, family: 4 }])
        else callback(null, address, 4)
      },
    })
  })
  return {
    lookup,
    calls,
    started: () => calls.map((call) => call.hostname),
    [Symbol.dispose]: () => lookup.mockRestore(),
  }
}

describe(createLimitedLookup, () => {
  it('runs one lookup at a time by default', async () => {
    using held = heldLookup()
    const lookup = createLimitedLookup(held.lookup)

    const first = lookupAsync(lookup, 'a.com', { all: true })
    const second = lookupAsync(lookup, 'b.com', { all: true })
    expect(held.started()).toEqual(['a.com'])

    held.calls[0].complete('192.0.2.1')
    await expect(first).resolves.toEqual({
      address: [{ address: '192.0.2.1', family: 4 }],
    })
    expect(held.started()).toEqual(['a.com', 'b.com'])

    held.calls[1].complete('192.0.2.2')
    await expect(second).resolves.toEqual({
      address: [{ address: '192.0.2.2', family: 4 }],
    })
  })

  it('runs up to `concurrency` lookups at once', async () => {
    using held = heldLookup()
    const lookup = createLimitedLookup(held.lookup, { concurrency: 2 })

    const results = ['a.com', 'b.com', 'c.com'].map((hostname) =>
      lookupAsync(lookup, hostname, {}),
    )
    expect(held.started()).toEqual(['a.com', 'b.com'])

    held.calls[1].complete('192.0.2.2')
    await expect(results[1]).resolves.toEqual({
      address: '192.0.2.2',
      family: 4,
    })
    expect(held.started()).toEqual(['a.com', 'b.com', 'c.com'])

    held.calls[0].complete('192.0.2.1')
    held.calls[2].complete('192.0.2.3')
    await Promise.all(results)
  })

  it('fails lookups that take too long, and keeps the slot of a running one until it completes', async () => {
    using held = heldLookup()
    const lookup = createLimitedLookup(held.lookup, { timeout: 50 })

    const running = vi.fn()
    lookup('a.com', {}, running)
    const queued = lookupAsync(lookup, 'b.com', {})

    await expect(queued).rejects.toMatchObject({ code: 'ETIMEOUT' })
    expect(running).toHaveBeenCalledOnce()
    expect(running.mock.calls[0][0]).toMatchObject({ code: 'ETIMEOUT' })

    // `dns.lookup` cannot be cancelled: the slot stays taken until it completes
    const next = lookupAsync(lookup, 'c.com', {})
    expect(held.started()).toEqual(['a.com'])

    held.calls[0].complete('192.0.2.1')
    expect(running).toHaveBeenCalledTimes(1)
    // The lookup that timed out while queued never runs
    expect(held.started()).toEqual(['a.com', 'c.com'])

    held.calls[1].complete('192.0.2.3')
    await expect(next).resolves.toEqual({ address: '192.0.2.3', family: 4 })
  })

  it('frees the slot of a lookup that throws', async () => {
    const lookup = createLimitedLookup((hostname, _options, callback) => {
      if (hostname === 'bad') throw new TypeError('Invalid hostname')
      callback(null, '192.0.2.1', 4)
    })

    await expect(lookupAsync(lookup, 'bad', {})).rejects.toThrow(
      'Invalid hostname',
    )
    await expect(lookupAsync(lookup, 'good.com', {})).resolves.toEqual({
      address: '192.0.2.1',
      family: 4,
    })
  })

  it('frees the slot of a lookup whose callback throws', async () => {
    using held = heldLookup()
    const lookup = createLimitedLookup(held.lookup)

    lookup('a.com', {}, () => {
      throw new Error('Callback failed')
    })
    const next = lookupAsync(lookup, 'b.com', {})

    expect(() => held.calls[0].complete('192.0.2.1')).toThrow('Callback failed')
    expect(held.started()).toEqual(['a.com', 'b.com'])

    held.calls[1].complete('192.0.2.2')
    await expect(next).resolves.toEqual({ address: '192.0.2.2', family: 4 })
  })

  it('calls back after the tick of a lookup that answers synchronously', async () => {
    const lookup = createLimitedLookup((_hostname, _options, callback) => {
      callback(null, '192.0.2.1', 4)
    })

    // As with `dns.lookup`: an exception thrown by the callback must not reach
    // the code that started the lookup.
    const callback = vi.fn()
    lookup('a.com', {}, callback)
    expect(callback).not.toHaveBeenCalled()

    await new Promise(process.nextTick)
    expect(callback).toHaveBeenCalledExactlyOnceWith(null, '192.0.2.1', 4)
  })

  it('drains lookups that answer synchronously without nesting calls', async () => {
    using held = heldLookup()
    const lookup = createLimitedLookup((hostname, options, callback) => {
      if (hostname === 'slow.com') held.lookup(hostname, options, callback)
      else callback(null, '192.0.2.1', 4)
    })

    lookup('slow.com', {}, () => {})
    // Enough to overflow the stack, were each started by the previous one
    const results = Array.from({ length: 20_000 }, (_, i) =>
      lookupAsync(lookup, `host-${i}.com`, {}),
    )

    held.calls[0].complete('192.0.2.2')
    await expect(Promise.all(results)).resolves.toHaveLength(20_000)
  })

  it.each([
    { concurrency: 0 },
    { concurrency: -1 },
    { concurrency: 1.5 },
    { concurrency: NaN },
    { timeout: 0 },
    { timeout: NaN },
    { timeout: Infinity },
    { timeout: 2 ** 31 },
  ])('rejects the options %j', (options) => {
    expect(() => createLimitedLookup(undefined, options)).toThrow(RangeError)
  })

  it('uses dns.lookup as patched after it was created', async () => {
    const lookup = createLimitedLookup()

    // e.g. instrumentation, which named imports of a builtin would not see
    using patched = vi.spyOn(dns, 'lookup').mockImplementation(((
      _hostname,
      _options,
      callback,
    ) => {
      callback(null, '192.0.2.1', 4)
    }) satisfies LookupFunction as typeof dns.lookup)

    await expect(lookupAsync(lookup, 'a.com', {})).resolves.toEqual({
      address: '192.0.2.1',
      family: 4,
    })
    expect(patched).toHaveBeenCalledWith(
      'a.com',
      expect.anything(),
      expect.any(Function),
    )
  })

  it('uses dns.lookup by default', async () => {
    // Only the system resolver reads /etc/hosts
    const { address } = await lookupAsync(createLimitedLookup(), 'localhost', {
      all: true,
    })

    expect(address).not.toHaveLength(0)
    for (const { address: ip } of address as LookupAddress[]) {
      expect(ipaddr.parse(ip).range()).toBe('loopback')
    }
  })
})

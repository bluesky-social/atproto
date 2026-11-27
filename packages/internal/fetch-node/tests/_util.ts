import { Resolver } from 'node:dns/promises'
import { isIP } from 'node:net'
import { vi } from 'vitest'

/**
 * Answers the `resolve4` and `resolve6` queries of every {@link Resolver},
 * including those created by the code under test, from {@link zone}.
 */
export function stubResolvers(zone: Record<string, string[]>) {
  const answer = (family: number) =>
    async function (hostname: string): Promise<string[]> {
      const addresses = zone[hostname]
      if (!addresses) throw dnsError('ENOTFOUND', hostname)
      const matching = addresses.filter((address) => isIP(address) === family)
      if (matching.length === 0) throw dnsError('ENODATA', hostname)
      return matching
    }

  const resolve4 = vi
    .spyOn(Resolver.prototype, 'resolve4')
    .mockImplementation(answer(4) as Resolver['resolve4'])
  const resolve6 = vi
    .spyOn(Resolver.prototype, 'resolve6')
    .mockImplementation(answer(6) as Resolver['resolve6'])

  return {
    resolve4,
    resolve6,
    [Symbol.dispose]() {
      resolve4.mockRestore()
      resolve6.mockRestore()
    },
  }
}

function dnsError(code: string, hostname: string) {
  return Object.assign(new Error(`query ${code} ${hostname}`), {
    code,
    hostname,
  })
}

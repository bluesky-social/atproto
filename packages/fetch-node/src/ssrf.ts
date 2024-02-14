import dns, { promises as dnsPromises } from 'node:dns'

import createError from 'http-errors'
import ipaddr from 'ipaddr.js'

const { IPv4, IPv6 } = ipaddr

export async function ssrfSafeHostname(hostname: string): Promise<string> {
  const ip = await hostnameLookup(hostname).catch((cause) => {
    throw cause?.code === 'ENOTFOUND'
      ? createError(400, `Invalid hostname ${hostname}`, { cause })
      : createError(500, `Unable resolve DNS for ${hostname}`, { cause })
  })
  if (ip.range() !== 'unicast') {
    throw createError(400, `Invalid hostname IP address ${ip}`)
  }
  return ip.toString()
}

export async function hostnameLookup(
  hostname: string,
): Promise<ipaddr.IPv4 | ipaddr.IPv6> {
  if (IPv4.isIPv4(hostname)) {
    return IPv4.parse(hostname)
  }

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return IPv6.parse(hostname.slice(1, -1))
  }

  return domainLookup(hostname)
}

export async function domainLookup(
  domain: string,
): Promise<ipaddr.IPv4 | ipaddr.IPv6> {
  const addr = await dnsPromises.lookup(domain, {
    hints: dns.ADDRCONFIG | dns.V4MAPPED,
  })

  const ip =
    addr.family === 4 ? IPv4.parse(addr.address) : IPv6.parse(addr.address)

  if (ip instanceof IPv6 && ip.isIPv4MappedAddress()) {
    return ip.toIPv4Address()
  }

  return ip
}

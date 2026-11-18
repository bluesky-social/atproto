import { isIP } from 'node:net'

const IPV4_MAPPED = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/

/**
 * Returns the canonical spelling of an IP address, so that one address always
 * yields one rate limit key: IPv4-mapped IPv6 becomes plain IPv4, and other
 * IPv6 addresses lose any zone ID and are lowercased and compressed as in RFC
 * 5952. Returns null for anything that is not an IP address.
 */
export function canonicalIp(ip: string): string | null {
  const family = isIP(ip)
  // node:net refuses leading zeros, so its IPv4 addresses are canonical.
  if (family === 4) return ip
  if (family !== 6) return null

  const zoneIdx = ip.indexOf('%')
  const address = zoneIdx === -1 ? ip : ip.slice(0, zoneIdx)

  // The WHATWG URL parser serializes IPv6 hosts in RFC 5952 form.
  let canonical: string
  try {
    canonical = new URL(`http://[${address}]`).hostname.slice(1, -1)
  } catch {
    return null
  }

  const mapped = IPV4_MAPPED.exec(canonical)
  if (mapped) {
    const hi = parseInt(mapped[1], 16)
    const lo = parseInt(mapped[2], 16)
    canonical = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
  }

  return isIP(canonical) === 0 ? null : canonical
}

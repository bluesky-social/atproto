import ipaddr from 'ipaddr.js'

const { IPv4, IPv6 } = ipaddr

function parseIpHostname(
  hostname: string,
): ipaddr.IPv4 | ipaddr.IPv6 | undefined {
  if (IPv4.isIPv4(hostname)) {
    return IPv4.parse(hostname)
  }

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return IPv6.parse(hostname.slice(1, -1))
  }

  return undefined
}

export function isUnicastIpHostname(hostname: string): boolean | undefined {
  const ip = parseIpHostname(hostname)
  return ip ? ip.range() === 'unicast' : undefined
}

export type Version = [major: number, minor: number, patch: number]
export function parseVersion(version?: string): Version | undefined {
  const match = version?.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return undefined
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}

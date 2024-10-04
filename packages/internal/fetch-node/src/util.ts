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

export function isUnicastIp(hostname: string): boolean | undefined {
  const ip = parseIpHostname(hostname)
  return ip ? ip.range() === 'unicast' : undefined
}

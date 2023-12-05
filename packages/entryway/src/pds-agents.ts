import AtpAgent from '@atproto/api'

export class PdsAgents {
  // @NOTE only use with entries in the pds table, not for e.g. arbitrary entries found in did documents.
  private cache = new Map<string, AtpAgent>()
  get(host: string) {
    const agent =
      this.cache.get(host) ?? new AtpAgent({ service: getPdsEndpoint(host) })
    if (!this.cache.has(host)) {
      this.cache.set(host, agent)
    }
    return agent
  }
}

export const getPdsEndpoint = (host: string) => {
  const service = new URL(`https://${host}`)
  if (service.hostname === 'localhost') {
    service.protocol = 'http:'
  }
  return service.origin
}

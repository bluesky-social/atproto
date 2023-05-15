import { AtpAgent } from '@atproto/api'
import { DidResolver } from '@atproto/did-resolver'
import { defaultFetchHandler } from '@atproto/xrpc'
import { TestPds } from './pds'

export const mockNetworkUtilities = (pds: TestPds) => {
  // Map pds public url to its local url when resolving from plc
  const origResolveDid = DidResolver.prototype.resolveDidNoCache
  DidResolver.prototype.resolveDidNoCache = async function (did) {
    const result = await (origResolveDid.call(this, did) as ReturnType<
      typeof origResolveDid
    >)
    const service = result?.service?.find((svc) => svc.id === '#atproto_pds')
    if (typeof service?.serviceEndpoint === 'string') {
      service.serviceEndpoint = service.serviceEndpoint.replace(
        pds.ctx.cfg.publicUrl,
        `http://localhost:${pds.port}`,
      )
    }
    return result
  }

  // Map pds public url and handles to pds local url
  AtpAgent.configure({
    fetch: (httpUri, ...args) => {
      const url = new URL(httpUri)
      const pdsUrl = pds.ctx.cfg.publicUrl
      const pdsHandleDomains = pds.ctx.cfg.availableUserDomains
      if (
        url.origin === pdsUrl ||
        pdsHandleDomains.some((handleDomain) => url.host.endsWith(handleDomain))
      ) {
        url.protocol = 'http:'
        url.host = `localhost:${pds.port}`
        return defaultFetchHandler(url.href, ...args)
      }
      return defaultFetchHandler(httpUri, ...args)
    },
  })
}

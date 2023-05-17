import { DidResolver, HandleResolver } from '@atproto/identity'
import { TestPds } from './pds'

export const mockNetworkUtilities = (pds: TestPds) => {
  // Map pds public url to its local url when resolving from plc
  const origResolveDid = DidResolver.prototype.resolveNoCache
  DidResolver.prototype.resolveNoCache = async function (did) {
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

  HandleResolver.prototype.resolve = async function (handle: string) {
    const isPdsHandle = pds.ctx.cfg.availableUserDomains.some((domain) =>
      handle.endsWith(domain),
    )
    if (!isPdsHandle) return undefined

    const url = `${pds.url}/.well-known/atproto-did`
    try {
      const res = await fetch(url, { headers: { host: handle } })
      return await res.text()
    } catch (err) {
      return undefined
    }
  }
}

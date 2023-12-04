import axios from 'axios'
import { IdResolver } from '@atproto/identity'
import { TestPds } from './pds'
import { TestBsky } from './bsky'

export const mockNetworkUtilities = (pdses: TestPds[], bsky?: TestBsky) => {
  for (const pds of pdses) {
    mockResolvers(pds.ctx.idResolver, pdses)
  }
  if (bsky) {
    mockResolvers(bsky.ctx.idResolver, pdses)
    mockResolvers(bsky.indexer.ctx.idResolver, pdses)
  }
}

export const mockResolvers = (idResolver: IdResolver, pdses: TestPds[]) => {
  // Map pds public url to its local url when resolving from plc
  const origResolveDid = idResolver.did.resolveNoCache
  idResolver.did.resolveNoCache = async (did: string) => {
    const result = await (origResolveDid.call(
      idResolver.did,
      did,
    ) as ReturnType<typeof origResolveDid>)
    const service = result?.service?.find((svc) => svc.id === '#atproto_pds')
    if (typeof service?.serviceEndpoint === 'string') {
      for (const pds of pdses) {
        service.serviceEndpoint = service.serviceEndpoint.replace(
          pds.ctx.cfg.service.publicUrl,
          `http://localhost:${pds.port}`,
        )
      }
    }
    return result
  }

  const origResolveHandleDns = idResolver.handle.resolveDns
  idResolver.handle.resolve = async (handle: string) => {
    const eligiblePdses = pdses.filter((pds) => {
      return pds.ctx.cfg.identity.serviceHandleDomains.some((domain) =>
        handle.endsWith(domain),
      )
    })

    if (!eligiblePdses.length) {
      return origResolveHandleDns.call(idResolver.handle, handle)
    }

    for (const pds of eligiblePdses) {
      const url = `${pds.url}/.well-known/atproto-did`
      try {
        const res = await axios.get(url, { headers: { host: handle } })
        return res.data
      } catch {
        // ignore
      }
    }
  }
}

export const mockMailer = (pds: TestPds) => {
  const mailer = pds.ctx.mailer
  const _origSendMail = mailer.transporter.sendMail
  mailer.transporter.sendMail = async (opts) => {
    const result = await _origSendMail.call(mailer.transporter, opts)
    console.log(`✉️ Email: ${JSON.stringify(result, null, 2)}`)
    return result
  }
}

const usedLockIds = new Set()
export const uniqueLockId = () => {
  let lockId: number
  do {
    lockId = 1000 + Math.ceil(1000 * Math.random())
  } while (usedLockIds.has(lockId))
  usedLockIds.add(lockId)
  return lockId
}

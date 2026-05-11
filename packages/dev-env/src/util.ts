import * as plc from '@did-plc/lib'
import { request } from 'undici'
import { Secp256k1Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { TestBsky } from './bsky'
import { TestPds } from './pds'
import { DidAndKey } from './types'

export const mockNetworkUtilities = (
  pds: TestPds | TestPds[],
  bsky?: TestBsky,
) => {
  const pdses = Array.isArray(pds) ? pds : [pds]
  for (const p of pdses) {
    mockResolvers(p.ctx.idResolver, pdses)
  }
  if (bsky) {
    mockResolvers(bsky.ctx.idResolver, pdses)
    mockResolvers(bsky.dataplane.idResolver, pdses)
  }
}

export const mockResolvers = (
  idResolver: IdResolver,
  pds: TestPds | TestPds[],
) => {
  const pdses = Array.isArray(pds) ? pds : [pds]

  // Map pds public url to its local url when resolving from plc
  const origResolveDid = idResolver.did.resolveNoCache
  idResolver.did.resolveNoCache = async (did: string) => {
    const result = await (origResolveDid.call(
      idResolver.did,
      did,
    ) as ReturnType<typeof origResolveDid>)
    const service = result?.service?.find((svc) => svc.id === '#atproto_pds')
    if (typeof service?.serviceEndpoint === 'string') {
      for (const p of pdses) {
        service.serviceEndpoint = service.serviceEndpoint.replace(
          p.ctx.cfg.service.publicUrl,
          `http://localhost:${p.port}`,
        )
      }
    }
    return result
  }

  const origResolveHandleDns = idResolver.handle.resolveDns
  idResolver.handle.resolve = async (handle: string) => {
    // Handle domains across PDSes are disjoint suffixes (.test, .test2, ...);
    // first match wins.
    const match = pdses.find((p) =>
      p.ctx.cfg.identity.serviceHandleDomains.some((d) => handle.endsWith(d)),
    )
    if (!match) {
      return origResolveHandleDns.call(idResolver.handle, handle)
    }

    const url = new URL(`/.well-known/atproto-did`, match.url)
    try {
      const res = await request(url, { headers: { host: handle } })
      if (res.statusCode !== 200) {
        await res.body.dump()
        return undefined
      }

      return res.body.text()
    } catch (err) {
      return undefined
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

export const createDidAndKey = async (opts: {
  plcUrl: string
  handle: string
  pds: string
}): Promise<DidAndKey> => {
  const { plcUrl, handle, pds } = opts
  const key = await Secp256k1Keypair.create({ exportable: true })
  const did = await new plc.Client(plcUrl).createDid({
    signingKey: key.did(),
    rotationKeys: [key.did()],
    handle,
    pds,
    signer: key,
  })
  return {
    key,
    did,
  }
}

import { fileURLToPath } from 'node:url'
import * as plc from '@did-plc/lib'
import { request } from 'undici'
import { Secp256k1Keypair } from '@atproto/crypto'
import type { IdResolver } from '@atproto/identity'
import type { DidString } from '@atproto/lex-schema'
import type { TestBsky } from './bsky.js'
import type { TestPds } from './pds.js'
import type { DidAndKey } from './types.js'

export const mockNetworkUtilities = (pds: TestPds, bsky?: TestBsky) => {
  mockResolvers(pds.ctx.idResolver, pds)
  if (bsky) {
    mockResolvers(bsky.ctx.idResolver, pds)
    mockResolvers(bsky.dataplane.idResolver, pds)
  }
}

export const mockResolvers = (
  idResolver: IdResolver,
  pds: TestPds,
  // handles resolve against the pds by default, but may point elsewhere e.g. an entryway
  handleResolveUrl: string = pds.url,
) => {
  // Map pds public url to its local url when resolving from plc
  const origResolveDid = idResolver.did.resolveNoCache
  idResolver.did.resolveNoCache = async (did: string) => {
    const result = await (origResolveDid.call(
      idResolver.did,
      did,
    ) as ReturnType<typeof origResolveDid>)
    const service = result?.service?.find((svc) => svc.id === '#atproto_pds')
    if (typeof service?.serviceEndpoint === 'string') {
      service.serviceEndpoint = service.serviceEndpoint.replace(
        pds.ctx.cfg.service.publicUrl,
        `http://localhost:${pds.port}`,
      )
    }
    return result
  }

  const origResolveHandleDns = idResolver.handle.resolveDns
  idResolver.handle.resolve = async (handle: string) => {
    const isPdsHandle = pds.ctx.cfg.identity.serviceHandleDomains.some(
      (domain) => handle.endsWith(domain),
    )
    if (!isPdsHandle) {
      return origResolveHandleDns.call(idResolver.handle, handle)
    }

    const url = new URL(`/.well-known/atproto-did`, handleResolveUrl)
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

const LOCK_ID_MIN = 1001
const LOCK_ID_MAX = 2000
const unusedLockIds = Array.from(
  { length: LOCK_ID_MAX - LOCK_ID_MIN + 1 },
  (_, i) => LOCK_ID_MIN + i,
)

/**
 * Returns a random Postgres advisory lock id between 1001 and 2000, never
 * the same one twice within a process. Ids are random rather than sequential
 * so that concurrent test processes sharing one database are unlikely to
 * collide.
 *
 * @throws {RangeError} once all 1000 ids have been handed out
 */
export function uniqueLockId(): number {
  if (unusedLockIds.length === 0) {
    throw new RangeError(
      `uniqueLockId: all ${LOCK_ID_MAX - LOCK_ID_MIN + 1} lock ids (${LOCK_ID_MIN}-${LOCK_ID_MAX}) have been used`,
    )
  }
  // @NOTE swap-remove a random entry, so each call is O(1) and never retries
  const index = Math.floor(Math.random() * unusedLockIds.length)
  const lockId = unusedLockIds[index]
  unusedLockIds[index] = unusedLockIds[unusedLockIds.length - 1]
  unusedLockIds.pop()
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
    did: did as DidString,
  }
}

/**
 * Absolute path of one of this package's test assets (images), resolved from
 * this module rather than the working directory.
 */
export const assetPath = (name: string): string =>
  fileURLToPath(new URL(`../assets/${name}`, import.meta.url))

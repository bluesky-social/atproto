import { getPdsEndpoint } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { DidDocument } from '@atproto/identity'
import { ServerConfig } from '../../../../config'
import AppContext from '../../../../context'
import { dbLogger } from '../../../../logger'

// generate an invite code preceded by the hostname
// with '.'s replaced by '-'s so it is not mistakable for a link
// ex: bsky-app-abc234-567xy
// regex: bsky-app-[a-z2-7]{5}-[a-z2-7]{5}
export const genInvCode = (cfg: ServerConfig): string => {
  return cfg.service.hostname.replaceAll('.', '-') + '-' + getRandomToken()
}

export const genInvCodes = (cfg: ServerConfig, count: number): string[] => {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(genInvCode(cfg))
  }
  return codes
}

// Formatted xxxxx-xxxxx where digits are in base32
export const getRandomToken = () => {
  const token = crypto.randomStr(8, 'base32').slice(0, 10)
  return token.slice(0, 5) + '-' + token.slice(5, 10)
}

export const didDocForSession = async (
  ctx: AppContext,
  account: { did: string; pdsDid: string | null },
): Promise<DidDocument | undefined> => {
  if (!ctx.cfg.identity.enableDidDocWithSession || account.pdsDid === null) {
    return
  }
  try {
    const [didDoc, pds] = await Promise.all([
      ctx.idResolver.did.resolve(account.did),
      ctx.services.account(ctx.db).getPds(account.pdsDid, { cached: true }),
    ])
    if (!didDoc || !pds) return
    if (getPdsHost(didDoc) === pds.host) {
      return didDoc
    }
    // no pds match, try again with fresh did doc
    const freshDidDoc = await ctx.idResolver.did.resolve(account.did, true)
    if (!freshDidDoc) return
    if (getPdsHost(freshDidDoc) === pds.host) {
      return didDoc
    }
  } catch (err) {
    dbLogger.warn({ err, did: account.did }, 'failed to resolve did doc')
  }
}

const getPdsHost = (didDoc: DidDocument) => {
  const pdsEndpoint = getPdsEndpoint(didDoc)
  if (!pdsEndpoint) return
  return new URL(pdsEndpoint).host
}

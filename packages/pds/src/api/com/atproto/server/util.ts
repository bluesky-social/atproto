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

// @TODO once supporting multiple pdses, validate pds in did doc based on allow-list.
export const didDocForSession = async (
  ctx: AppContext,
  did: string,
  forceRefresh?: boolean,
): Promise<DidDocument | undefined> => {
  if (!ctx.cfg.identity.enableDidDocWithSession) return
  try {
    const didDoc = await ctx.idResolver.did.resolve(did, forceRefresh)
    return didDoc ?? undefined
  } catch (err) {
    dbLogger.warn({ err, did }, 'failed to resolve did doc')
  }
}

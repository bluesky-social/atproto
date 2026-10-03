import * as plc from '@did-plc/lib'
import { check, getPdsEndpoint, getSigningDidKey } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import type { DidDocument, IdResolver } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { ActorStore } from '../../../../actor-store/actor-store.js'
import type { ServerConfig } from '../../../../config/index.js'
import { httpLogger } from '../../../../logger.js'

// generate an invite code preceded by the hostname
// with '.'s replaced by '-'s so it is not mistakable for a link
// ex: bsky-app-abc23-567xy
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

export const safeResolveDidDoc = async (
  ctx: { idResolver: IdResolver },
  did: string,
  forceRefresh?: boolean,
): Promise<DidDocument | undefined> => {
  try {
    const didDoc = await ctx.idResolver.did.resolve(did, forceRefresh)
    return didDoc ?? undefined
  } catch (err) {
    httpLogger.warn({ err, did }, 'failed to resolve did doc')
  }
}

export const didDocForSession = async (
  ctx: { idResolver: IdResolver; cfg: ServerConfig },
  did: string,
  forceRefresh?: boolean,
): Promise<DidDocument | undefined> => {
  if (!ctx.cfg.identity.enableDidDocWithSession) return
  return safeResolveDidDoc(ctx, did, forceRefresh)
}

export const isValidDidDocForService = async (
  ctx: {
    plcClient: plc.Client
    idResolver: IdResolver
    cfg: ServerConfig
    actorStore: ActorStore
  },
  did: string,
): Promise<boolean> => {
  try {
    await assertValidDidDocumentForService(ctx, did)
    return true
  } catch {
    return false
  }
}

export const serverRotationKeyDid = (ctx: {
  cfg: ServerConfig
  plcRotationKey: crypto.Keypair
}): string => ctx.cfg.entryway?.plcRotationKey ?? ctx.plcRotationKey.did()

export function assertNotTombstoned(
  op: plc.CompatibleOpOrTombstone,
): asserts op is plc.CompatibleOp {
  if (check.is(op, plc.def.tombstone)) {
    throw new InvalidRequestError('Did is tombstoned')
  }
}

// @NOTE op may be current (eg. from getLastOp) or proposed (eg.
// client-submitted)
export function assertCanSignUpdatesForDid(
  op: plc.CompatibleOpOrTombstone,
  rotationKeyDid: string,
): asserts op is plc.CompatibleOp {
  assertNotTombstoned(op)
  if (!plc.normalizeOp(op).rotationKeys.includes(rotationKeyDid)) {
    throw new InvalidRequestError(
      "Rotation keys do not include server's rotation key",
    )
  }
}

export const assertValidDidDocumentForService = async (
  ctx: {
    plcClient: plc.Client
    idResolver: IdResolver
    cfg: ServerConfig
    actorStore: ActorStore
  },
  did: string,
) => {
  if (did.startsWith('did:plc')) {
    const lastOp = await ctx.plcClient.getLastOp(did)
    assertNotTombstoned(lastOp)
    const resolved = plc.normalizeOp(lastOp)
    await assertValidDocContents(ctx, did, {
      pdsEndpoint: resolved.services['atproto_pds']?.endpoint,
      signingKey: resolved.verificationMethods['atproto'],
    })
  } else {
    const resolved = await ctx.idResolver.did.resolve(did, true)
    if (!resolved) {
      throw new InvalidRequestError('Could not resolve DID')
    }
    await assertValidDocContents(ctx, did, {
      pdsEndpoint: getPdsEndpoint(resolved),
      signingKey: getSigningDidKey(resolved),
    })
  }
}

const assertValidDocContents = async (
  ctx: {
    cfg: ServerConfig
    actorStore: ActorStore
  },
  did: string,
  contents: {
    signingKey?: string
    pdsEndpoint?: string
  },
) => {
  const { signingKey, pdsEndpoint } = contents

  if (!pdsEndpoint || pdsEndpoint !== ctx.cfg.service.publicUrl) {
    throw new InvalidRequestError(
      'DID document atproto_pds service endpoint does not match PDS public url',
    )
  }

  const keypair = await ctx.actorStore.keypair(did)
  if (!signingKey || signingKey !== keypair.did()) {
    throw new InvalidRequestError(
      'DID document verification method does not match expected signing key',
    )
  }
}

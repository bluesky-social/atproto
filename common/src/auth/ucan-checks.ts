import { Request } from 'express'
import * as ucan from 'ucans'
import { Chained, isCapabilityEscalation } from 'ucans'
import TID from '../repo/tid.js'
import { Collection } from '../repo/types.js'
import {
  writeCap,
  blueskyCapabilities,
  blueskySemantics,
} from './bluesky-capability.js'

type Check = (ucan: Chained) => Error | null

export const checkReq = async (
  req: Request,
  ...checks: Check[]
): Promise<Chained> => {
  const header = req.headers.authorization
  if (!header) {
    throw new Error('No Ucan found in message headers')
  }

  const stripped = header.replace('Bearer ', '')
  const decoded = await ucan.Chained.fromToken(stripped)
  return checkUcan(decoded, ...checks)
}

export const checkUcan = async (
  token: ucan.Chained,
  ...checks: Check[]
): Promise<Chained> => {
  for (let i = 0; i < checks.length; i++) {
    const maybeErr = checks[i](token)
    if (maybeErr !== null) {
      throw maybeErr
    }
  }

  return token
}

export const isRoot =
  () =>
  (token: Chained): Error | null => {
    if (token.proofs && token.proofs.length > 0) {
      throw new Error('Ucan is an attenuation and not the root')
    }
    return null
  }

export const hasAudience =
  (did: string) =>
  (token: Chained): Error | null => {
    if (token.audience() !== did) {
      return new Error('Ucan audience does not match server Did')
    }
    return null
  }

export const hasPostingPermission =
  (did: string, program: string, collection: Collection, tid: TID) =>
  (token: Chained): Error | null => {
    // the capability we need for the given post
    const needed = writeCap(did, program, collection, tid)
    for (const cap of blueskyCapabilities(token)) {
      // skip over escalations
      if (isCapabilityEscalation(cap)) continue
      // check if this capability includes the one we need, if not skip
      const attempt = blueskySemantics.tryDelegating(cap.capability, needed)
      if (attempt === null || isCapabilityEscalation(attempt)) continue
      // check root did matches the repo's did
      if (cap.info.originator !== did) {
        return new Error(
          `Posting permission does not come from the user's root DID: ${did}`,
        )
      }
      // check capability is not expired
      if (cap.info.expiresAt < Date.now() / 1000) {
        return new Error(`Ucan is expired`)
      }
      // check capability is not too early
      if (cap.info.notBefore && cap.info.notBefore > Date.now() / 1000) {
        return new Error(`Ucan is being used before it's "not before" time`)
      }
      // all looks good, we return null 👍
      return null
    }
    // we looped through all options & couldn't find the capability we need
    return new Error(
      `Ucan does not permission the ability to post for user: ${did}`,
    )
  }

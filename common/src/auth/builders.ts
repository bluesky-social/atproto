import * as ucan from 'ucans'
import TID from '../repo/tid.js'
import { Collection } from '../repo/types.js'
import { maintenanceCap, writeCap } from './bluesky-capability.js'

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30

export const forPost = async (
  serverDid: string,
  did: string,
  program: string,
  collection: Collection,
  tid: TID,
  keypair: ucan.Keypair,
): Promise<ucan.Chained> => {
  return ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(serverDid)
    .withLifetimeInSeconds(30)
    .claimCapability(writeCap(did, program, collection, tid))
    .build()
}

export const fullyPermissioned = (
  audience: string,
  keypair: ucan.Keypair & ucan.Didable,
): Promise<ucan.Chained> => {
  return ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(audience)
    .withLifetimeInSeconds(MONTH_IN_SECONDS)
    .claimCapability(writeCap(keypair.did()))
    .build()
}

export const maintenance = (
  audience: string,
  keypair: ucan.Keypair & ucan.Didable,
): Promise<ucan.Chained> => {
  return ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(audience)
    .withLifetimeInSeconds(MONTH_IN_SECONDS)
    .claimCapability(maintenanceCap(keypair.did()))
    .build()
}

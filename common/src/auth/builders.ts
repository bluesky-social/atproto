import * as ucan from 'ucans'
import TID from '../repo/tid.js'
import { Collection } from '../repo/types.js'
import {
  blueskySemantics,
  maintenanceCap,
  writeCap,
} from './bluesky-capability.js'

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30

export const delegateForPost = async (
  serverDid: string,
  did: string,
  program: string,
  collection: Collection,
  tid: TID,
  keypair: ucan.Keypair,
  ucanStore: ucan.Store,
): Promise<ucan.Chained> => {
  return ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(serverDid)
    .withLifetimeInSeconds(30)
    .delegateCapability(
      blueskySemantics,
      writeCap(did, program, collection, tid),
      ucanStore,
    )
    .build()
}

export const delegateForRelationship = async (
  serverDid: string,
  did: string,
  keypair: ucan.Keypair,
  ucanStore: ucan.Store,
): Promise<ucan.Chained> => {
  return ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(serverDid)
    .withLifetimeInSeconds(30)
    .delegateCapability(
      blueskySemantics,
      writeCap(did, 'relationships'),
      ucanStore,
    )
    .build()
}

export const delegateMaintenance = (
  audience: string,
  keypair: ucan.Keypair & ucan.Didable,
  ucanStore: ucan.Store,
): Promise<ucan.Chained> => {
  return ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(audience)
    .withLifetimeInSeconds(30)
    .delegateCapability(
      blueskySemantics,
      maintenanceCap(keypair.did()),
      ucanStore,
    )
    .build()
}

export const claimFull = (
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

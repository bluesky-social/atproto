import * as ucan from 'ucans'
import { adxSemantics, maintenanceCap, writeCap } from './capability.js'

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30

export const delegateForPost = async (
  serverDid: string,
  did: string,
  collection: string,
  record: string,
  keypair: ucan.Keypair,
  ucanStore: ucan.Store,
): Promise<ucan.Chained> => {
  return ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(serverDid)
    .withLifetimeInSeconds(30)
    .delegateCapability(
      adxSemantics,
      writeCap(did, collection, record),
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
    .delegateCapability(adxSemantics, writeCap(did, 'relationships'), ucanStore)
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
    .delegateCapability(adxSemantics, maintenanceCap(keypair.did()), ucanStore)
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

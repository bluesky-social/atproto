import * as ucan from 'ucans'
import { adxSemantics, maintenanceCap, writeCap } from './capability.js'

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30
const YEAR_IN_SECONDS = MONTH_IN_SECONDS * 12

export const delegateForPost = async (
  serverDid: string,
  did: string,
  collection: string,
  schema: string,
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
      writeCap(did, collection, schema, record),
      ucanStore,
    )
    .build()
}

export const delegateForCollections = async (
  serverDid: string,
  did: string,
  collections: string[],
  keypair: ucan.Keypair,
  ucanStore: ucan.Store,
): Promise<ucan.Chained> => {
  const token = await ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(serverDid)
    .withLifetimeInSeconds(30)
  for (const c in collections) {
    await token.delegateCapability(adxSemantics, writeCap(did, c), ucanStore)
  }
  return token.build()
}

export const delegateForRep = async (
  serverDid: string,
  did: string,
  keypair: ucan.Keypair,
  ucanStore: ucan.Store,
): Promise<ucan.Chained> => {
  const token = await ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(serverDid)
    .withLifetimeInSeconds(30)
    .delegateCapability(adxSemantics, writeCap(did), ucanStore)
  return token.build()
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
    .withLifetimeInSeconds(YEAR_IN_SECONDS)
    .claimCapability(writeCap(keypair.did()))
    .build()
}

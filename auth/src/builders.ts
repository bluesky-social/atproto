import * as ucan from 'ucans'
import { adxSemantics, maintenanceCap, writeCap } from './capability.js'
import { YEAR_IN_SEC } from './consts.js'

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

export const delegateForRepo = async (
  audience: string,
  did: string,
  keypair: ucan.Keypair,
  ucanStore: ucan.Store,
  lifetime = 30,
): Promise<ucan.Chained> => {
  const token = await ucan.Builder.create()
    .issuedBy(keypair)
    .toAudience(audience)
    .withLifetimeInSeconds(lifetime)
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
    .withLifetimeInSeconds(10 * YEAR_IN_SEC)
    .claimCapability(writeCap(keypair.did()))
    .build()
}

import * as ucan from 'ucans'
import { writeCap } from './bluesky-capability.js'

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30

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

import * as ucan from 'ucans'

import { writeCap } from '../auth/bluesky-capability.js'
import TID from '../repo/tid.js'
import { Collection } from '../repo/types.js'

export const delegateToken = async (
  serverDid: string,
  did: string,
  program: string,
  collection: Collection,
  tid: TID,
  keypair: ucan.Keypair,
): Promise<ucan.Chained> => {
  return (
    ucan.Builder.create()
      .issuedBy(keypair)
      .toAudience(serverDid)
      .withLifetimeInSeconds(30)
      .claimCapability(writeCap(did, program, collection, tid))
      // .delegateCapability(
      //   blueskySemantics,
      //   blueskyCapability(did, program, collection, tid),
      //   authority,
      // )
      .build()
  )
}

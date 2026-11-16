import * as plc from '@did-plc/lib'
import type { Keypair } from '@atproto/crypto'

/**
 * Format the PLC genesis op for a new account. Like `plc.createOp`, but it also
 * publishes the account's `#atproto_kem` key, which syncers use to establish
 * shared secrets for space repo MACs.
 */
export const createPlcOp = async (opts: {
  signingKey: string
  kemKey: string
  handle: string
  pds: string
  rotationKeys: string[]
  signer: Keypair
}): Promise<{ op: plc.Operation; did: string }> => {
  const unsigned = plc.formatAtprotoOp({ ...opts, prev: null })
  unsigned.verificationMethods.atproto_kem = opts.kemKey
  const op = await plc.signOperation(unsigned, opts.signer)
  const did = await plc.didForCreateOp(op)
  return { op, did }
}

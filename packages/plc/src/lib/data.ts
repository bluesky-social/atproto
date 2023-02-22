import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import * as cbor from '@ipld/dag-cbor'
import { check, cidForCbor, HOUR } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import * as t from './types'
import { ServerError } from '../server/error'
import { didForCreateOp, normalizeCreateOp } from './operations'

export const assureValidNextOp = async (
  did: string,
  ops: t.IndexedOperation[],
  proposed: t.Operation,
): Promise<{ nullified: CID[]; prev: CID | null }> => {
  // ensure we support the proposed keys
  const keys = [proposed.signingKey, ...proposed.rotationKeys]
  await Promise.all(keys.map((k) => crypto.parseDidKey(k)))

  // special case if account creation
  if (ops.length === 0) {
    await assureValidCreationOp(did, proposed)
    return { nullified: [], prev: null }
  }

  const proposedPrev = proposed.prev ? CID.parse(proposed.prev) : undefined
  if (!proposedPrev) {
    throw new ServerError(400, `Invalid prev on operation: ${proposed.prev}`)
  }

  const indexOfPrev = ops.findIndex((op) => proposedPrev.equals(op.cid))
  if (indexOfPrev < 0) {
    throw new ServerError(409, 'Operations not correctly ordered')
  }

  // if we are forking history, these are the ops still in the proposed canonical history
  const opsInHistory = ops.slice(0, indexOfPrev + 1)
  const nullified = ops.slice(indexOfPrev + 1)
  const lastOp = opsInHistory.at(-1)
  if (!lastOp) {
    throw new ServerError(400, 'Could not locate last op in history')
  }
  const lastOpNormalized = normalizeCreateOp(lastOp.operation)
  const firstNullified = nullified[0]
  // const firstNullifiedNormalized = normalizeCreateOp(firstNullified.operation)

  // if this does not involve nullification
  if (!firstNullified) {
    await assureValidSig(lastOpNormalized.rotationKeys, proposed)
    return { nullified: [], prev: proposedPrev }
  }

  const disputedSigner = await assureValidSig(
    lastOpNormalized.rotationKeys,
    firstNullified.operation,
  )

  const indexOfSigner = lastOpNormalized.rotationKeys.indexOf(disputedSigner)
  const morePowerfulKeys = lastOpNormalized.rotationKeys.slice(
    indexOfSigner + 1,
  )

  await assureValidSig(morePowerfulKeys, proposed)

  // recovery key gets a 72hr window to do historical re-wrties
  if (nullified.length > 0) {
    const RECOVERY_WINDOW = 72 * HOUR
    const timeLapsed = Date.now() - firstNullified.createdAt.getTime()
    if (timeLapsed > RECOVERY_WINDOW) {
      throw new ServerError(
        400,
        'Recovery operation occured outside of the allowed 72 hr recovery window',
      )
    }
  }

  return {
    nullified: nullified.map((op) => op.cid),
    prev: proposedPrev,
  }
}

export const validateOperationLog = async (
  did: string,
  ops: (t.CreateOpV1 | t.Operation)[],
): Promise<t.DocumentData> => {
  // make sure they're all validly formatted operations
  const [first, ...rest] = ops
  if (!check.is(first, t.def.compatibleOp)) {
    throw new ServerError(400, `Improperly formatted operation: ${first}`)
  }
  for (const op of rest) {
    if (!check.is(op, t.def.operation)) {
      throw new ServerError(400, `Improperly formatted operation: ${op}`)
    }
  }

  // ensure the first op is a valid & signed create operation
  let doc = await assureValidCreationOp(did, first)
  let prev = await cidForCbor(first)

  for (const op of rest) {
    if (!op.prev || !CID.parse(op.prev).equals(prev)) {
      throw new ServerError(400, 'Operations not correctly ordered')
    }

    await assureValidSig(doc.rotationKeys, op)
    const { signingKey, rotationKeys, handles, services } = op
    doc = { did, signingKey, rotationKeys, handles, services }
    prev = await cidForCbor(op)
  }

  return doc
}

export const assureValidCreationOp = async (
  did: string,
  op: t.CompatibleOp,
): Promise<t.DocumentData> => {
  const normalized = normalizeCreateOp(op)
  await assureValidSig(normalized.rotationKeys, op)
  const expectedDid = await didForCreateOp(op, 64)
  if (!expectedDid.startsWith(did)) {
    throw new ServerError(
      400,
      `Hash of genesis operation does not match DID identifier: ${expectedDid}`,
    )
  }
  if (op.prev !== null) {
    throw new ServerError(400, `Prev of create op is not null: ${op}`)
  }
  const { signingKey, rotationKeys, handles, services } = normalized
  return { did, signingKey, rotationKeys, handles, services }
}

export const assureValidSig = async (
  allowedDids: string[],
  op: t.CreateOpV1 | t.Operation,
): Promise<string> => {
  const { sig, ...opData } = op
  const sigBytes = uint8arrays.fromString(sig, 'base64url')
  const dataBytes = new Uint8Array(cbor.encode(opData))
  let isValid = true
  for (const did of allowedDids) {
    isValid = await crypto.verifySignature(did, dataBytes, sigBytes)
    if (isValid) return did
  }
  throw new ServerError(400, `Invalid signature on op: ${JSON.stringify(op)}`)
}

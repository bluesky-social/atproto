import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import * as cbor from '@ipld/dag-cbor'
import { check, cidForData } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import * as t from './types'
import { ServerError } from '../server/error'

export const assureValidNextOp = async (
  did: string,
  ops: t.IndexedOperation[],
  proposed: t.Operation,
): Promise<{ nullified: CID[]; prev: CID | null }> => {
  // special case if account creation
  if (ops.length === 0) {
    if (!check.is(proposed, t.def.createOp)) {
      throw new ServerError(400, 'Expected first operation to be `create`')
    }
    await assureValidCreationOp(did, proposed)
    return { nullified: [], prev: null }
  }

  // ensure we support the proposed key type
  if (
    check.is(proposed, t.def.rotateSigningKeyOp) ||
    check.is(proposed, t.def.rotateRecoveryKeyOp)
  ) {
    await crypto.parseDidKey(proposed.key)
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

  const doc = await validateOperationLog(
    did,
    opsInHistory.map((op) => op.operation),
  )
  const allowedKeys =
    nullified.length === 0
      ? [doc.signingKey, doc.recoveryKey]
      : [doc.recoveryKey] // only the recovery key is allowed to do historical re-writes

  await assureValidSig(allowedKeys, proposed)

  // recovery key gets a 72hr window to do historical re-wrties
  if (nullified.length > 0) {
    const RECOVERY_WINDOW = 1000 * 60 * 60 * 72
    const firstNullfied = nullified[0]
    const timeLapsed = Date.now() - firstNullfied.createdAt.getTime()
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
  ops: t.Operation[],
): Promise<t.DocumentData> => {
  // make sure they're all validly formatted operations
  for (const op of ops) {
    if (!check.is(op, t.def.operation)) {
      throw new ServerError(400, `Improperly formatted operation: ${op}`)
    }
  }

  // ensure the first op is a valid & signed create operation
  const [first, ...rest] = ops
  if (!check.is(first, t.def.createOp)) {
    throw new ServerError(400, 'Expected first operation to be `create`')
  }
  await assureValidCreationOp(did, first)

  // iterate through operations to reconstruct the current state of the document
  const doc: t.DocumentData = {
    did,
    signingKey: first.signingKey,
    recoveryKey: first.recoveryKey,
    username: first.username,
    atpPds: first.service,
  }
  let prev = await cidForData(first)

  for (const op of rest) {
    if (!op.prev || !CID.parse(op.prev).equals(prev)) {
      throw new ServerError(400, 'Operations not correctly ordered')
    }

    await assureValidSig([doc.signingKey, doc.recoveryKey], op)
    if (check.is(op, t.def.createOp)) {
      throw new ServerError(400, 'Unexpected `create` after DID genesis')
    } else if (check.is(op, t.def.rotateSigningKeyOp)) {
      doc.signingKey = op.key
    } else if (check.is(op, t.def.rotateRecoveryKeyOp)) {
      doc.recoveryKey = op.key
    } else if (check.is(op, t.def.updateUsernameOp)) {
      doc.username = op.username
    } else if (check.is(op, t.def.updateAtpPdsOp)) {
      doc.atpPds = op.service
    } else {
      throw new ServerError(400, `Unknown operation: ${JSON.stringify(op)}`)
    }
    prev = await cidForData(op)
  }

  return doc
}

export const hashAndFindDid = async (op: t.CreateOp, truncate = 24) => {
  const hashOfGenesis = await crypto.sha256(cbor.encode(op))
  const hashB32 = uint8arrays.toString(hashOfGenesis, 'base32')
  const truncated = hashB32.slice(0, truncate)
  return `did:plc:${truncated}`
}

export const assureValidCreationOp = async (did: string, op: t.CreateOp) => {
  await assureValidSig([op.signingKey], op)
  const expectedDid = await hashAndFindDid(op, 64)
  if (!expectedDid.startsWith(did)) {
    throw new ServerError(
      400,
      `Hash of genesis operation does not match DID identifier: ${expect}`,
    )
  }
}

export const assureValidSig = async (
  allowedDids: string[],
  op: t.Operation,
) => {
  const { sig, ...opData } = op
  const sigBytes = uint8arrays.fromString(sig, 'base64url')
  const dataBytes = new Uint8Array(cbor.encode(opData))
  let isValid = true
  for (const did of allowedDids) {
    isValid = await crypto.verifyDidSig(did, dataBytes, sigBytes)
    if (isValid) return
  }
  throw new ServerError(400, `Invalid signature on op: ${JSON.stringify(op)}`)
}

export const formatDidDoc = (data: t.DocumentData): t.DidDocument => {
  const context = ['https://www.w3.org/ns/did/v1']

  const signingKeyInfo = formatKeyAndContext(data.signingKey)
  const recoveryKeyInfo = formatKeyAndContext(data.recoveryKey)
  const verificationMethods = [signingKeyInfo, recoveryKeyInfo]
  verificationMethods.forEach((method) => {
    if (!context.includes(method.context)) {
      context.push(method.context)
    }
  })

  return {
    '@context': context,
    id: data.did,
    alsoKnownAs: [ensureHttpPrefix(data.username)],
    verificationMethod: [
      {
        id: `#signingKey`,
        type: signingKeyInfo.type,
        controller: data.did,
        publicKeyMultibase: signingKeyInfo.publicKeyMultibase,
      },
      {
        id: `#recoveryKey`,
        type: recoveryKeyInfo.type,
        controller: data.did,
        publicKeyMultibase: recoveryKeyInfo.publicKeyMultibase,
      },
    ],
    assertionMethod: [`#signingKey`],
    capabilityInvocation: [`#signingKey`],
    capabilityDelegation: [`#signingKey`],
    service: [
      {
        id: `#atpPds`,
        type: 'AtpPersonalDataServer',
        serviceEndpoint: ensureHttpPrefix(data.atpPds),
      },
    ],
  }
}

type KeyAndContext = {
  context: string
  type: string
  publicKeyMultibase
}

const formatKeyAndContext = (key: string): KeyAndContext => {
  let keyInfo
  try {
    keyInfo = crypto.parseDidKey(key)
  } catch (err) {
    throw new ServerError(400, `Could not parse did:key: ${err}`)
  }
  const { jwtAlg, keyBytes } = keyInfo

  if (jwtAlg === 'ES256') {
    return {
      context: 'https://w3id.org/security/suites/ecdsa-2019/v1',
      type: 'EcdsaSecp256r1VerificationKey2019',
      publicKeyMultibase: `z${uint8arrays.toString(keyBytes, 'base58btc')}`,
    }
  }
  throw new ServerError(400, `Unsupported key type: ${jwtAlg}`)
}

export const ensureHttpPrefix = (str: string): string => {
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str
  }
  return `https://${str}`
}

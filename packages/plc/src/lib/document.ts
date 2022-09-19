import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import * as cbor from '@ipld/dag-cbor'
import { check, cidForData } from '@adxp/common'
import * as crypto from '@adxp/crypto'
import * as t from './types'

export const assureValidNextOp = async (
  did: string,
  ops: t.Operation[],
  proposed: t.Operation,
) => {
  // special case if account creation
  if (ops.length === 0) {
    if (!check.is(proposed, t.def.createOp)) {
      throw new Error('Expected first operation to be `create`')
    }
    await assureValidCreationOp(did, proposed)
    return
  }

  const doc = await validateOperationLog(did, ops)
  await assureValidSig([doc.signingKey, doc.recoveryKey], proposed)
  const prev = await cidForData(ops[ops.length - 1])
  if (!proposed.prev || !CID.parse(proposed.prev).equals(prev)) {
    throw new Error('Operations not correctly ordered')
  }
}

export const validateOperationLog = async (
  did: string,
  ops: t.Operation[],
): Promise<t.DocumentData> => {
  // make sure they're all validly formatted operations
  for (const op of ops) {
    if (!check.is(op, t.def.operation)) {
      throw new Error(`Improperly formatted operation: ${op}`)
    }
  }

  // ensure the first op is a valid & signed create operation
  const [first, ...rest] = ops
  if (!check.is(first, t.def.createOp)) {
    throw new Error('Expected first operation to be `create`')
  }
  await assureValidCreationOp(did, first)

  // iterate through operations to reconstruct the current state of the document
  const doc: t.DocumentData = {
    did,
    signingKey: first.signingKey,
    recoveryKey: first.recoveryKey,
    username: first.username,
    service: first.service,
  }
  let prev = await cidForData(first)

  for (const op of rest) {
    // @TODO should signing key be able to rotate reocvery key?? & should reocvery key be able to change username/service
    if (!op.prev || !CID.parse(op.prev).equals(prev)) {
      throw new Error('Operations not correctly ordered')
    }

    if (check.is(op, t.def.createOp)) {
      throw new Error('Unexpected `create` after DID genesis')
    } else if (check.is(op, t.def.rotateSigningKeyOp)) {
      await assureValidSig([doc.signingKey, doc.recoveryKey], op)
      doc.signingKey = op.key
    } else if (check.is(op, t.def.rotateRecoveryKeyOp)) {
      await assureValidSig([doc.signingKey, doc.recoveryKey], op)
      doc.recoveryKey = op.key
    } else if (check.is(op, t.def.updateUsernameOp)) {
      await assureValidSig([doc.signingKey], op)
      doc.username = op.username
    } else if (check.is(op, t.def.updateServiceOp)) {
      await assureValidSig([doc.signingKey], op)
      doc.service = op.service
    } else {
      throw new Error('Unknown operation')
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
    throw new Error('Hash of genesis operation does not match DID identifier')
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
  throw new Error(`Invalid signature on op: ${op}`)
}

export const formatDidDoc = async (data: t.DocumentData) => {
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
    alsoKnownAs: `https://${data.username}`,
    verificationMethod: [
      {
        id: `${data.did}#signingKey`,
        type: signingKeyInfo.type,
        controller: data.did,
        publicKeyMultibase: signingKeyInfo.publicKeyMultibase,
      },
      {
        id: `${data.did}#recoveryKey`,
        type: recoveryKeyInfo.type,
        controller: data.did,
        publicKeyMultibase: recoveryKeyInfo.publicKeyMultibase,
      },
    ],
    assertionMethod: [`${data.did}#signingKey`],
    service: [
      {
        id: `${data.did}#atpPds`,
        type: 'AtpPersonalDataServer',
        serviceEndpoint: data.service,
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
  const DID_KEY_PREFIX = 'did:key:z'
  const plugins = [crypto.p256Plugin]

  if (!key.startsWith(DID_KEY_PREFIX)) {
    throw new Error(`Not a valid did:key: ${key}`)
  }
  const prefixedBytes = uint8arrays.fromString(
    key.slice(DID_KEY_PREFIX.length),
    'base58btc',
  )
  const plugin = plugins.find((p) => hasPrefix(prefixedBytes, p.prefix))
  if (!plugin) {
    throw new Error('Unsupported key type')
  }

  if (plugin.jwtAlg === 'ES256') {
    const compressedKeyBytes = prefixedBytes.slice(plugin.prefix.length)
    const keyBytes = crypto.decompressPubkey(compressedKeyBytes)
    return {
      context: 'https://w3id.org/security/suites/ecdsa-2019/v1',
      type: 'EcdsaSecp256r1VerificationKey2019',
      publicKeyMultibase: `z${uint8arrays.toString(keyBytes, 'base58btc')}`,
    }
  }
  throw new Error('Unsupported key type')
}

const hasPrefix = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
  return uint8arrays.equals(prefix, bytes.subarray(0, prefix.byteLength))
}

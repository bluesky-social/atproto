import * as cbor from '@ipld/dag-cbor'
import * as uint8arrays from 'uint8arrays'
import { DidableKey, sha256 } from '@atproto/crypto'
import * as t from './types'

export const didForCreateOp = async (op: t.CreateOp, truncate = 24) => {
  const hashOfGenesis = await sha256(cbor.encode(op))
  const hashB32 = uint8arrays.toString(hashOfGenesis, 'base32')
  const truncated = hashB32.slice(0, truncate)
  return `did:plc:${truncated}`
}

export const signOperation = async (
  op: t.UnsignedOperation,
  signingKey: DidableKey,
): Promise<t.Operation> => {
  const data = new Uint8Array(cbor.encode(op))
  const sig = await signingKey.sign(data)
  return {
    ...op,
    sig: uint8arrays.toString(sig, 'base64url'),
  }
}

export const create = async (
  signingKey: DidableKey,
  recoveryKey: string,
  username: string,
  service: string,
): Promise<t.CreateOp> => {
  const op: t.UnsignedCreateOp = {
    type: 'create',
    signingKey: signingKey.did(),
    recoveryKey,
    username,
    service,
    prev: null,
  }
  const signed = await signOperation(op, signingKey)
  return signed as t.CreateOp
}

export const rotateSigningKey = async (
  newKey: string,
  prev: string,
  signingKey: DidableKey,
): Promise<t.Operation> => {
  const op: t.UnsignedRotateSigningKeyOp = {
    type: 'rotate_signing_key',
    key: newKey,
    prev,
  }
  return signOperation(op, signingKey)
}

export const rotateRecoveryKey = async (
  newKey: string,
  prev: string,
  signingKey: DidableKey,
): Promise<t.Operation> => {
  const op: t.UnsignedRotateRecoveryKeyOp = {
    type: 'rotate_recovery_key',
    key: newKey,
    prev,
  }
  return signOperation(op, signingKey)
}

export const updateUsername = async (
  username: string,
  prev: string,
  signingKey: DidableKey,
): Promise<t.Operation> => {
  const op: t.UnsignedUpdateUsernameOp = {
    type: 'update_username',
    username,
    prev,
  }
  return signOperation(op, signingKey)
}

export const updateAtpPds = async (
  service: string,
  prev: string,
  signingKey: DidableKey,
): Promise<t.Operation> => {
  const op: t.UnsignedUpdateAtpPdsOp = {
    type: 'update_atp_pds',
    service,
    prev,
  }
  return signOperation(op, signingKey)
}

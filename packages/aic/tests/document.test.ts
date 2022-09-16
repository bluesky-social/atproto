import { check, cidForData } from '@adxp/common'
import { EcdsaKeypair } from '@adxp/crypto'
import * as document from '../src/lib/document'
import * as operations from '../src/lib/operations'
import * as t from '../src/lib/types'

describe('aic DID document', () => {
  const ops: t.Operation[] = []

  let signingKey: EcdsaKeypair
  let recoveryKey: EcdsaKeypair
  let did: string
  let username = 'alice.example.com'
  let service = 'example.com'

  let oldSigningKey: EcdsaKeypair
  let oldRecoveryKey: EcdsaKeypair

  beforeAll(async () => {
    signingKey = await EcdsaKeypair.create()
    recoveryKey = await EcdsaKeypair.create()
  })

  it('creates a valid create op', async () => {
    const createOp = await operations.create(
      signingKey,
      recoveryKey.did(),
      username,
      service,
    )
    const isValid = check.is(createOp, t.def.createOp)
    expect(isValid).toBeTruthy()
    ops.push(createOp)
    did = await operations.didForCreateOp(createOp as any)
  })

  it('parses an operation log with no updates', async () => {
    const doc = await document.validateOperationLog(did, ops)

    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.service).toEqual(service)
  })

  it('allows for updating username', async () => {
    username = 'ali.example2.com'
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.updateUsername(
      username,
      prev.toString(),
      signingKey,
    )
    ops.push(op)

    const doc = await document.validateOperationLog(did, ops)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.service).toEqual(service)
  })

  it('allows for updating service', async () => {
    service = 'example2.com'
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.updateService(
      service,
      prev.toString(),
      signingKey,
    )
    ops.push(op)

    const doc = await document.validateOperationLog(did, ops)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.service).toEqual(service)
  })

  it('allows for rotating signingKey', async () => {
    const newSigningKey = await EcdsaKeypair.create()
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.rotateSigningKey(
      newSigningKey.did(),
      prev.toString(),
      signingKey,
    )
    ops.push(op)
    oldSigningKey = signingKey
    signingKey = newSigningKey

    const doc = await document.validateOperationLog(did, ops)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.service).toEqual(service)
  })

  it('no longer allows operations from old signing key', async () => {
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.updateUsername(
      'bob',
      prev.toString(),
      oldSigningKey,
    )
    expect(document.validateOperationLog(did, [...ops, op])).rejects.toThrow()
  })

  it('allows for rotating recoveryKey', async () => {
    const newRecoveryKey = await EcdsaKeypair.create()
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.rotateRecoveryKey(
      newRecoveryKey.did(),
      prev.toString(),
      signingKey,
    )
    ops.push(op)
    oldRecoveryKey = recoveryKey
    recoveryKey = newRecoveryKey

    const doc = await document.validateOperationLog(did, ops)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.service).toEqual(service)
  })

  it('no longer allows operations from old recovery key', async () => {
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.updateUsername(
      'bob',
      prev.toString(),
      oldRecoveryKey,
    )
    expect(document.validateOperationLog(did, [...ops, op])).rejects.toThrow()
  })

  it('it allows recovery key to rotate signing key', async () => {
    const newKey = await EcdsaKeypair.create()
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.rotateSigningKey(
      newKey.did(),
      prev.toString(),
      recoveryKey,
    )
    ops.push(op)
    signingKey = newKey
    const doc = await document.validateOperationLog(did, ops)
    expect(doc.signingKey).toEqual(newKey.did())
  })

  it('it allows recovery key to rotate recovery key', async () => {
    const newKey = await EcdsaKeypair.create()
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.rotateRecoveryKey(
      newKey.did(),
      prev.toString(),
      recoveryKey,
    )
    ops.push(op)
    recoveryKey = newKey
    const doc = await document.validateOperationLog(did, ops)
    expect(doc.recoveryKey).toEqual(newKey.did())
  })

  it('it does not allow recovery key to update username', async () => {
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.updateUsername(
      'bob',
      prev.toString(),
      recoveryKey,
    )
    expect(document.validateOperationLog(did, [...ops, op])).rejects.toThrow()
  })

  it('it does not allow recovery key to update service', async () => {
    const prev = await cidForData(ops[ops.length - 1])
    const op = await operations.updateService(
      'foobar.com',
      prev.toString(),
      recoveryKey,
    )
    expect(document.validateOperationLog(did, [...ops, op])).rejects.toThrow()
  })

  it('requires operations to be in order', async () => {
    const prev = await cidForData(ops[ops.length - 2])
    const op = await operations.updateService(
      'foobar.com',
      prev.toString(),
      signingKey,
    )
    expect(document.validateOperationLog(did, [...ops, op])).rejects.toThrow()
  })

  it('does not allow a create operation in the middle of the log', async () => {
    const op = await operations.create(
      signingKey,
      recoveryKey.did(),
      username,
      service,
    )
    expect(document.validateOperationLog(did, [...ops, op])).rejects.toThrow()
  })

  it('requires that the log start with a create operation', async () => {
    const [first, ...rest] = ops
    expect(document.validateOperationLog(did, rest)).rejects.toThrow()
  })

  it('returns a valid DID document', async () => {
    const data = await document.validateOperationLog(did, ops)
    const didDoc = await document.formatDidDoc(data)
    console.log(data)
    console.log(didDoc)
  })
})

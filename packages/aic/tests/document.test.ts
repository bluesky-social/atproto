import { check } from '@adxp/common'
import { EcdsaKeypair } from '@adxp/crypto'
import * as document from '../src/document'
import * as operations from '../src/operations'
import * as t from '../src/types'

describe('aic DID document', () => {
  const ops: t.Operation[] = []

  let signingKey: EcdsaKeypair
  let recoveryKey: EcdsaKeypair
  let did: string
  const username = 'alice.example.com'
  const service = 'example.com'

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
    const isValid = check.is(createOp, t.createOp)
    expect(isValid).toBeTruthy()
    ops.push(createOp)
    did = await operations.didForCreateOp(createOp as any)
  })

  it('parses an operation log with no updates', async () => {
    const doc = await document.validateOperationLog(did, ops)
    console.log(doc)
  })
})

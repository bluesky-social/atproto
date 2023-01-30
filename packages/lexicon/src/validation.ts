import { Lexicons } from './lexicons'
import {
  LexRecord,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
} from './types'
import { assertValidOneOf } from './util'

import * as ComplexValidators from './validators/complex'
import * as XrpcValidators from './validators/xrpc'

export function assertValidRecord(
  lexicons: Lexicons,
  def: LexRecord,
  value: unknown,
) {
  const res = ComplexValidators.object(lexicons, 'Record', def.record, value)
  if (!res.success) throw res.error
}

export function assertValidXrpcParams(
  lexicons: Lexicons,
  def: LexXrpcProcedure | LexXrpcQuery | LexXrpcSubscription,
  value: unknown,
) {
  if (def.parameters) {
    const res = XrpcValidators.params(lexicons, 'Params', def.parameters, value)
    if (!res.success) throw res.error
  }
}

export function assertValidXrpcInput(
  lexicons: Lexicons,
  def: LexXrpcProcedure,
  value: unknown,
) {
  if (def.input?.schema) {
    // loop: all input schema definitions
    assertValidOneOf(lexicons, 'Input', def.input.schema, value, true)
  }
}

export function assertValidXrpcOutput(
  lexicons: Lexicons,
  def: LexXrpcProcedure | LexXrpcQuery,
  value: unknown,
) {
  if (def.output?.schema) {
    // loop: all output schema definitions
    assertValidOneOf(lexicons, 'Output', def.output.schema, value, true)
  }
}

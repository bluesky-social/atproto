import { Lexicons } from './lexicons'
import { LexRecord, LexXrpcProcedure, LexXrpcQuery } from './types'
import { assertValidOneOf, validateOneOf, toConcreteTypes } from './util'

import * as ComplexValidators from './validators/complex'
import * as XrpcValidators from './validators/xrpc'

export function assertValidRecord(
  lexicons: Lexicons,
  defs: LexRecord[],
  value: unknown,
) {
  // loop: all record definitions
  assertValidOneOf('Record', defs, (def) =>
    ComplexValidators.object(lexicons, 'Record', def.record, value),
  )
}

export function assertValidXrpcParams(
  lexicons: Lexicons,
  defs: (LexXrpcProcedure | LexXrpcQuery)[],
  value: unknown,
) {
  // loop: all query/procedure definitions
  assertValidOneOf('Parameters', defs, (def) => {
    if (def.parameters) {
      return XrpcValidators.params(lexicons, 'Params', def.parameters, value)
    }
    return { success: true }
  })
}

export function assertValidXrpcInput(
  lexicons: Lexicons,
  defs: LexXrpcProcedure[],
  value: unknown,
) {
  // loop: all procedure definitions
  assertValidOneOf('Input', defs, (def) => {
    if (def.input?.schema) {
      // loop: all input schema definitions
      return validateOneOf(
        'Input',
        toConcreteTypes(lexicons, def.input.schema),
        (def2) => ComplexValidators.object(lexicons, 'Input', def2, value),
      )
    }
    return { success: true }
  })
}

export function assertValidXrpcOutput(
  lexicons: Lexicons,
  defs: (LexXrpcProcedure | LexXrpcQuery)[],
  value: unknown,
) {
  // loop: all query/procedure definitions
  assertValidOneOf('Output', defs, (def) => {
    if (def.output?.schema) {
      // loop: all output schema definitions
      return validateOneOf(
        'Output',
        toConcreteTypes(lexicons, def.output.schema),
        (def2) => ComplexValidators.object(lexicons, 'Output', def2, value),
      )
    }
    return { success: true }
  })
}

import { Infer } from '../core.js'
import { LexArray } from './array.js'
import { LexBoolean } from './boolean.js'
import { LexInteger } from './integer.js'
import { LexString } from './string.js'
import { LexUnion } from './union.js'

const lexParameterScalarSchema = new LexUnion([
  new LexBoolean({}),
  new LexInteger({}),
  new LexString({}),
])

export const lexParameterSchema = new LexUnion([
  lexParameterScalarSchema,
  new LexArray(lexParameterScalarSchema, {}),
])

export type LexParameterValue = Infer<typeof lexParameterSchema>

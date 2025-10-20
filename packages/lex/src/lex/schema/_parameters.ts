import { Infer } from '../core.js'
import { ArraySchema } from './array.js'
import { BooleanSchema } from './boolean.js'
import { IntegerSchema } from './integer.js'
import { StringSchema } from './string.js'
import { UnionSchema } from './union.js'

const parameterScalarSchema = new UnionSchema([
  new BooleanSchema({}),
  new IntegerSchema({}),
  new StringSchema({}),
])

export const parameterSchema = new UnionSchema([
  parameterScalarSchema,
  new ArraySchema(parameterScalarSchema, {}),
])

export type Parameter = Infer<typeof parameterSchema>
export type Parameters = Record<string, Parameter>

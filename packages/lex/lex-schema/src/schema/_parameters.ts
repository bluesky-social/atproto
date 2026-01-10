import { Infer, Validator } from '../core.js'
import { ArraySchema } from './array.js'
import { BooleanSchema } from './boolean.js'
import { DictSchema } from './dict.js'
import { IntegerSchema } from './integer.js'
import { StringSchema } from './string.js'
import { UnionSchema } from './union.js'

export type ParamScalar = Infer<typeof paramScalarSchema>
const paramScalarSchema = new UnionSchema([
  new BooleanSchema({}),
  new IntegerSchema({}),
  new StringSchema({}),
])

export type Param = Infer<typeof paramSchema>
export const paramSchema = new UnionSchema([
  paramScalarSchema,
  new ArraySchema(paramScalarSchema, {}),
])

export type Params = { [_: string]: undefined | Param }
export const paramsSchema = new DictSchema(
  new StringSchema({}),
  paramSchema,
) satisfies Validator<Params>

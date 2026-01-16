import { Schema } from '../core.js'
import { ArraySchema } from './array.js'
import { BooleanSchema } from './boolean.js'
import { DictSchema } from './dict.js'
import { IntegerSchema } from './integer.js'
import { StringSchema } from './string.js'
import { UnionSchema } from './union.js'

export type ParamScalar = boolean | number | string
const paramScalarSchema: Schema<ParamScalar> = new UnionSchema([
  new BooleanSchema(),
  new IntegerSchema(),
  new StringSchema(),
])

export type Param = ParamScalar | ParamScalar[]
export const paramSchema: Schema<Param> = new UnionSchema([
  paramScalarSchema,
  new ArraySchema(paramScalarSchema, {}),
])

export type Params = { [x: string]: undefined | Param }
export const paramsSchema: Schema<Params> = new DictSchema(
  new StringSchema(),
  paramSchema,
)

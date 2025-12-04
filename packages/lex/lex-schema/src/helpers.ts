import {
  InferPayload,
  InferPayloadData,
  InferPayloadEncoding,
  Procedure,
  Query,
  Subscription,
} from './schema.js'
import { Infer } from './validation.js'

export type Method = Procedure | Query | Subscription

export type InferMethodParams<M extends Method> = Infer<M['parameters']>

export type InferMethodInput<M extends Method> = M extends Procedure
  ? InferPayload<M['input']>
  : never

export type InferMethodInputData<M extends Method> = M extends Procedure
  ? InferPayloadData<M['input']>
  : never

export type InferMethodInputEncoding<M extends Method> = M extends Procedure
  ? InferPayloadEncoding<M['input']>
  : never

export type InferMethodOutput<M extends Method> = M extends Procedure | Query
  ? InferPayload<M['output']>
  : never

export type InferMethodOutputData<M extends Method> = M extends
  | Procedure
  | Query
  ? InferPayloadData<M['output']>
  : never

export type InferMethodOutputEncoding<M extends Method> = M extends
  | Procedure
  | Query
  ? InferPayloadEncoding<M['output']>
  : never

export type InferMethodMessage<M extends Method> = M extends Subscription
  ? Infer<M['message']>
  : never

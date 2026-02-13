import { decodeAll, encode } from '@atproto/lex-cbor'
import { LexValue, isPlainObject } from '@atproto/lex-data'
import { XRPCError } from '../errors'
import {
  ErrorFrameBody,
  ErrorFrameHeader,
  FrameHeader,
  FrameType,
  MessageFrameHeader,
  errorFrameBody,
  frameHeader,
} from './types'

export abstract class Frame<T extends LexValue = LexValue> {
  abstract header: FrameHeader
  abstract body: T

  get op(): FrameType {
    return this.header.op
  }
  toBytes(): Uint8Array {
    return Buffer.concat([encode(this.header), encode(this.body)])
  }
  isMessage(): this is MessageFrame {
    return this.op === FrameType.Message
  }
  isError(): this is ErrorFrame {
    return this.op === FrameType.Error
  }
  static fromBytes(bytes: Uint8Array) {
    const [header, body, ...rest] = decodeAll(bytes)
    if (rest.length) {
      throw new Error('Too many CBOR data items in frame')
    } else if (body === undefined) {
      throw new Error('Missing frame body')
    }

    const parsedHeader = frameHeader.safeParse(header)
    if (!parsedHeader.success) {
      throw new Error(`Invalid frame header: ${parsedHeader.error.message}`)
    }
    const frameOp = parsedHeader.data.op
    if (frameOp === FrameType.Message) {
      return new MessageFrame(body, {
        type: parsedHeader.data.t,
      })
    } else if (frameOp === FrameType.Error) {
      const parsedBody = errorFrameBody.safeParse(body)
      if (!parsedBody.success) {
        throw new Error(`Invalid error frame body: ${parsedBody.error.message}`)
      }
      return new ErrorFrame(parsedBody.data)
    } else {
      const exhaustiveCheck: never = frameOp
      throw new Error(`Unknown frame op: ${exhaustiveCheck}`)
    }
  }
}

export class MessageFrame<T extends LexValue = LexValue> extends Frame<T> {
  header: MessageFrameHeader
  body: T

  constructor(body: T, opts?: { type?: string }) {
    super()
    this.header =
      opts?.type !== undefined
        ? { op: FrameType.Message, t: opts?.type }
        : { op: FrameType.Message }
    this.body = body
  }
  get type() {
    return this.header.t
  }

  static fromLexValue(data: LexValue, nsid: string) {
    if (!isPlainObject(data)) {
      return new MessageFrame(data)
    }

    const $type = data?.['$type']
    if (typeof $type !== 'string') {
      return new MessageFrame(data)
    }

    let type: string

    const split = $type.split('#')
    if (split.length === 2 && (split[0] === '' || split[0] === nsid)) {
      type = `#${split[1]}`
    } else {
      type = $type
    }

    const { $type: _, ...clone } = data
    return new MessageFrame(clone, { type })
  }
}

export class ErrorFrame<T extends string = string> extends Frame<
  ErrorFrameBody<T>
> {
  header: ErrorFrameHeader
  body: ErrorFrameBody<T>

  constructor(body: ErrorFrameBody<T>) {
    super()
    this.header = { op: FrameType.Error }
    this.body = body
  }
  get code() {
    return this.body.error
  }
  get message() {
    return this.body.message
  }

  static fromError(err: unknown): ErrorFrame {
    if (err instanceof ErrorFrame) return err
    const { error = 'Unknown', message } = XRPCError.fromError(err).payload
    return new ErrorFrame({ error, message })
  }
}

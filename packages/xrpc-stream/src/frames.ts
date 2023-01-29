import * as cborx from 'cbor-x'
import * as uint8arrays from 'uint8arrays'
import {
  frameHeader,
  FrameHeader,
  FrameType,
  InfoFrameHeader,
  MessageFrameHeader,
  ErrorFrameHeader,
} from './types'

export abstract class Frame {
  header: FrameHeader
  body: unknown
  get op(): FrameType {
    return this.header.op
  }
  toBytes(): Uint8Array {
    return uint8arrays.concat([
      cborx.encode(this.header),
      cborx.encode(this.body),
    ])
  }
  static fromBytes(bytes: Uint8Array) {
    let i = 0
    let header: unknown
    let body: unknown = kUnset
    cborx.decodeMultiple(bytes, (item) => {
      if (i === 0) {
        header = item
      } else if (i === 1) {
        body = item
      } else {
        throw new Error('Too many CBOR data items in frame')
      }
      i++
    })
    const parsedHeader = frameHeader.safeParse(header)
    if (!parsedHeader.success) {
      throw new Error(`Invalid frame header: ${parsedHeader.error.message}`)
    }
    if (body === kUnset) {
      throw new Error('Missing frame body')
    }
    const frameOp = parsedHeader.data.op
    if (frameOp === FrameType.Message) {
      return new MessageFrame({
        messageId: parsedHeader.data.id,
        type: parsedHeader.data.t,
        body,
      })
    } else if (frameOp === FrameType.Info) {
      return new InfoFrame({
        type: parsedHeader.data.t,
        body,
      })
    } else if (frameOp === FrameType.Error) {
      if (body !== undefined) {
        throw new Error('Error frame must have an empty body')
      }
      return new ErrorFrame({
        code: parsedHeader.data.err,
        message: parsedHeader.data.msg,
      })
    } else {
      const exhaustiveCheck: never = frameOp
      throw new Error(`Unknown frame op: ${exhaustiveCheck}`)
    }
  }
}

export class MessageFrame extends Frame {
  header: MessageFrameHeader
  constructor(opts: { messageId?: string; type?: string; body: unknown }) {
    super()
    this.body = opts.body
    this.header = {
      op: FrameType.Message,
      id: opts.messageId,
      t: opts.type,
    }
  }
  get messageId() {
    return this.header.id
  }
  get type() {
    return this.header.t
  }
}

export class InfoFrame extends Frame {
  header: InfoFrameHeader
  constructor(opts: { type?: string; body: unknown }) {
    super()
    this.body = opts.body
    this.header = {
      op: FrameType.Info,
      t: opts.type,
    }
  }
  get type() {
    return this.header.t
  }
}

export class ErrorFrame extends Frame {
  header: ErrorFrameHeader
  constructor(opts?: { code?: string; message?: string }) {
    super()
    this.header = {
      op: FrameType.Error,
      err: opts?.code,
      msg: opts?.message,
    }
  }
  get code() {
    return this.header.err
  }
  get message() {
    return this.header.msg
  }
}

const kUnset = Symbol('unset')

import * as cborx from 'cbor-x'
import * as uint8arrays from 'uint8arrays'
import {
  frameHeader,
  FrameHeader,
  FrameType,
  InfoFrameHeader,
  DataFrameHeader,
  ErrorFrameHeader,
  infoFrameBody,
  InfoFrameBody,
  ErrorFrameBody,
  errorFrameBody,
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
    if (frameOp === FrameType.Data) {
      return new DataFrame({
        type: parsedHeader.data.t,
        body,
      })
    } else if (frameOp === FrameType.Info) {
      const parsedBody = infoFrameBody.safeParse(body)
      if (!parsedBody.success) {
        throw new Error(`Invalid info frame body: ${parsedBody.error.message}`)
      }
      return new InfoFrame({
        body: parsedBody.data,
      })
    } else if (frameOp === FrameType.Error) {
      const parsedBody = errorFrameBody.safeParse(body)
      if (!parsedBody.success) {
        throw new Error(`Invalid error frame body: ${parsedBody.error.message}`)
      }
      return new ErrorFrame({
        body: parsedBody.data,
      })
    } else {
      const exhaustiveCheck: never = frameOp
      throw new Error(`Unknown frame op: ${exhaustiveCheck}`)
    }
  }
}

export class DataFrame extends Frame {
  header: DataFrameHeader
  constructor(opts: { type?: number; body: unknown }) {
    super()
    this.header = { op: FrameType.Data, t: opts.type }
    this.body = opts.body
  }
  get type() {
    return this.header.t
  }
}

export class InfoFrame<T extends string = string> extends Frame {
  header: InfoFrameHeader
  body: InfoFrameBody<T>
  constructor(opts: { body: InfoFrameBody<T> }) {
    super()
    this.header = { op: FrameType.Info }
    this.body = opts.body
  }
  get code() {
    return this.body.info
  }
  get message() {
    return this.body.message
  }
}

export class ErrorFrame<T extends string = string> extends Frame {
  header: ErrorFrameHeader
  body: ErrorFrameBody<T>
  constructor(opts: { body: ErrorFrameBody<T> }) {
    super()
    this.header = { op: FrameType.Error }
    this.body = opts.body
  }
  get code() {
    return this.body.error
  }
  get message() {
    return this.body.message
  }
}

const kUnset = Symbol('unset')

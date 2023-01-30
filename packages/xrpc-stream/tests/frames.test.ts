import * as cborx from 'cbor-x'
import * as uint8arrays from 'uint8arrays'
import { ErrorFrame, Frame, FrameType, InfoFrame, MessageFrame } from '../src'

describe('Frames', () => {
  it('creates and parses message frame.', async () => {
    const messageFrame = new MessageFrame({
      messageId: '22',
      type: 'com.object',
      body: { a: 'b', c: [1, 2, 3] },
    })

    expect(messageFrame.header).toEqual({
      op: FrameType.Message,
      id: '22',
      t: 'com.object',
    })
    expect(messageFrame.op).toEqual(FrameType.Message)
    expect(messageFrame.messageId).toEqual('22')
    expect(messageFrame.type).toEqual('com.object')
    expect(messageFrame.body).toEqual({ a: 'b', c: [1, 2, 3] })

    const bytes = messageFrame.toBytes()
    expect([...bytes]).toEqual([
      /*header*/ 185, 0, 3, 98, 111, 112, 1, 98, 105, 100, 98, 50, 50, 97, 116,
      106, 99, 111, 109, 46, 111, 98, 106, 101, 99, 116, /*body*/ 185, 0, 2, 97,
      97, 97, 98, 97, 99, 131, 1, 2, 3,
    ])

    const parsedFrame = Frame.fromBytes(bytes)
    if (!(parsedFrame instanceof MessageFrame)) {
      throw new Error('Did not parse as message frame')
    }

    expect(parsedFrame.header).toEqual(messageFrame.header)
    expect(parsedFrame.op).toEqual(messageFrame.op)
    expect(parsedFrame.messageId).toEqual(messageFrame.messageId)
    expect(parsedFrame.type).toEqual(messageFrame.type)
    expect(parsedFrame.body).toEqual(messageFrame.body)
  })

  it('creates and parses info frame.', async () => {
    const infoFrame = new InfoFrame({
      type: 'com.object',
      body: { a: 'b', c: [1, 2, 3] },
    })

    expect(infoFrame.header).toEqual({
      op: FrameType.Info,
      t: 'com.object',
    })
    expect(infoFrame.op).toEqual(FrameType.Info)
    expect(infoFrame.type).toEqual('com.object')
    expect(infoFrame.body).toEqual({ a: 'b', c: [1, 2, 3] })

    const bytes = infoFrame.toBytes()
    expect([...bytes]).toEqual([
      /*header*/ 185, 0, 2, 98, 111, 112, 2, 97, 116, 106, 99, 111, 109, 46,
      111, 98, 106, 101, 99, 116, /*body*/ 185, 0, 2, 97, 97, 97, 98, 97, 99,
      131, 1, 2, 3,
    ])

    const parsedFrame = Frame.fromBytes(bytes)
    if (!(parsedFrame instanceof InfoFrame)) {
      throw new Error('Did not parse as info frame')
    }

    expect(parsedFrame.header).toEqual(infoFrame.header)
    expect(parsedFrame.op).toEqual(infoFrame.op)
    expect(parsedFrame.type).toEqual(infoFrame.type)
    expect(parsedFrame.body).toEqual(infoFrame.body)
  })

  it('creates and parses error frame.', async () => {
    const errorFrame = new ErrorFrame({
      code: 'BigOops',
      message: 'Something went awry',
    })

    expect(errorFrame.header).toEqual({
      op: FrameType.Error,
      err: 'BigOops',
      msg: 'Something went awry',
    })

    expect(errorFrame.op).toEqual(FrameType.Error)
    expect(errorFrame.code).toEqual('BigOops')
    expect(errorFrame.message).toEqual('Something went awry')
    expect(errorFrame.body).toEqual(undefined)

    const bytes = errorFrame.toBytes()
    expect([...bytes]).toEqual([
      /*header*/ 185, 0, 3, 98, 111, 112, 32, 99, 101, 114, 114, 103, 66, 105,
      103, 79, 111, 112, 115, 99, 109, 115, 103, 115, 83, 111, 109, 101, 116,
      104, 105, 110, 103, 32, 119, 101, 110, 116, 32, 97, 119, 114, 121,
      /*body*/ 247,
    ])

    const parsedFrame = Frame.fromBytes(bytes)
    if (!(parsedFrame instanceof ErrorFrame)) {
      throw new Error('Did not parse as error frame')
    }

    expect(parsedFrame.header).toEqual(errorFrame.header)
    expect(parsedFrame.code).toEqual(errorFrame.code)
    expect(parsedFrame.message).toEqual(errorFrame.message)
    expect(parsedFrame.body).toEqual(errorFrame.body)
  })

  it('parsing fails when frame is not CBOR.', async () => {
    const bytes = Buffer.from('some utf8 bytes')
    const emptyBytes = Buffer.from('')
    expect(() => Frame.fromBytes(bytes)).toThrow('Unexpected end of CBOR data')
    expect(() => Frame.fromBytes(emptyBytes)).toThrow(
      'Unexpected end of CBOR data',
    )
  })

  it('parsing fails when frame header is malformed.', async () => {
    const bytes = uint8arrays.concat([
      cborx.encode({ op: -2 }), // Unknown op
      cborx.encode({ a: 'b', c: [1, 2, 3] }),
    ])

    expect(() => Frame.fromBytes(bytes)).toThrow('Invalid frame header:')
  })

  it('parsing fails when frame is missing body.', async () => {
    const messageFrame = new MessageFrame({
      messageId: '22',
      type: 'com.object',
      body: { a: 'b', c: [1, 2, 3] },
    })

    const headerBytes = cborx.encode(messageFrame.header)

    expect(() => Frame.fromBytes(headerBytes)).toThrow('Missing frame body')
  })

  it('parsing fails when frame has too many data items.', async () => {
    const messageFrame = new MessageFrame({
      messageId: '22',
      type: 'com.object',
      body: { a: 'b', c: [1, 2, 3] },
    })

    const bytes = uint8arrays.concat([
      messageFrame.toBytes(),
      cborx.encode({ d: 'e', f: [4, 5, 6] }),
    ])

    expect(() => Frame.fromBytes(bytes)).toThrow(
      'Too many CBOR data items in frame',
    )
  })

  it('parsing fails when error frame has non-empty body.', async () => {
    const errorFrame = new ErrorFrame({ code: 'BadOops' })

    const bytes = uint8arrays.concat([
      cborx.encode(errorFrame.header),
      cborx.encode({ a: 'b', c: [1, 2, 3] }),
    ])

    expect(() => Frame.fromBytes(bytes)).toThrow(
      'Error frame must have an empty body',
    )
  })
})

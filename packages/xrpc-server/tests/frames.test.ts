import * as cborx from 'cbor-x'
import * as uint8arrays from 'uint8arrays'
import { MessageFrame, ErrorFrame, Frame, FrameType } from '../src'

describe('Frames', () => {
  it('creates and parses message frame.', async () => {
    const messageFrame = new MessageFrame(
      { a: 'b', c: [1, 2, 3] },
      { type: '#d' },
    )

    expect(messageFrame.header).toEqual({
      op: FrameType.Message,
      t: '#d',
    })
    expect(messageFrame.op).toEqual(FrameType.Message)
    expect(messageFrame.type).toEqual('#d')
    expect(messageFrame.body).toEqual({ a: 'b', c: [1, 2, 3] })

    const bytes = messageFrame.toBytes()
    expect(
      uint8arrays.equals(
        bytes,
        new Uint8Array([
          /*header*/ 162, 97, 116, 98, 35, 100, 98, 111, 112, 1, /*body*/ 162,
          97, 97, 97, 98, 97, 99, 131, 1, 2, 3,
        ]),
      ),
    ).toEqual(true)

    const parsedFrame = Frame.fromBytes(bytes)
    if (!(parsedFrame instanceof MessageFrame)) {
      throw new Error('Did not parse as message frame')
    }

    expect(parsedFrame.header).toEqual(messageFrame.header)
    expect(parsedFrame.op).toEqual(messageFrame.op)
    expect(parsedFrame.type).toEqual(messageFrame.type)
    expect(parsedFrame.body).toEqual(messageFrame.body)
  })

  it('creates and parses error frame.', async () => {
    const errorFrame = new ErrorFrame({
      error: 'BigOops',
      message: 'Something went awry',
    })

    expect(errorFrame.header).toEqual({ op: FrameType.Error })
    expect(errorFrame.op).toEqual(FrameType.Error)
    expect(errorFrame.code).toEqual('BigOops')
    expect(errorFrame.message).toEqual('Something went awry')
    expect(errorFrame.body).toEqual({
      error: 'BigOops',
      message: 'Something went awry',
    })

    const bytes = errorFrame.toBytes()
    expect(
      uint8arrays.equals(
        bytes,
        new Uint8Array([
          /*header*/ 161, 98, 111, 112, 32, /*body*/ 162, 101, 101, 114, 114,
          111, 114, 103, 66, 105, 103, 79, 111, 112, 115, 103, 109, 101, 115,
          115, 97, 103, 101, 115, 83, 111, 109, 101, 116, 104, 105, 110, 103,
          32, 119, 101, 110, 116, 32, 97, 119, 114, 121,
        ]),
      ),
    ).toEqual(true)

    const parsedFrame = Frame.fromBytes(bytes)
    if (!(parsedFrame instanceof ErrorFrame)) {
      throw new Error('Did not parse as error frame')
    }

    expect(parsedFrame.header).toEqual(errorFrame.header)
    expect(parsedFrame.op).toEqual(errorFrame.op)
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
    const messageFrame = new MessageFrame(
      { a: 'b', c: [1, 2, 3] },
      { type: '#d' },
    )

    const headerBytes = cborx.encode(messageFrame.header)

    expect(() => Frame.fromBytes(headerBytes)).toThrow('Missing frame body')
  })

  it('parsing fails when frame has too many data items.', async () => {
    const messageFrame = new MessageFrame(
      { a: 'b', c: [1, 2, 3] },
      { type: '#d' },
    )

    const bytes = uint8arrays.concat([
      messageFrame.toBytes(),
      cborx.encode({ d: 'e', f: [4, 5, 6] }),
    ])

    expect(() => Frame.fromBytes(bytes)).toThrow(
      'Too many CBOR data items in frame',
    )
  })

  it('parsing fails when error frame has invalid body.', async () => {
    const errorFrame = new ErrorFrame({ error: 'BadOops' })

    const bytes = uint8arrays.concat([
      cborx.encode(errorFrame.header),
      cborx.encode({ blah: 1 }),
    ])

    expect(() => Frame.fromBytes(bytes)).toThrow('Invalid error frame body:')
  })
})

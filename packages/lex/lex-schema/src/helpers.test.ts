import { describe, test } from 'vitest'
import * as l from './external.js'

class BinaryValue {
  declare readonly ['__binaryValue']: BinaryValue
}

const expectType = <T>(_: T) => {}
const binaryValue = new BinaryValue()

describe('InferMethodParams', () => {
  describe('query', () => {
    test('infers parameter types', () => {
      const query = l.query(
        'com.example.query',
        l.params({
          feed: l.string({ format: 'at-uri' }),
          limit: l.optional(l.integer()),
        }),
        l.payload('application/json', undefined),
      )

      type Params = l.InferMethodParams<typeof query>

      expectType<Params>({
        feed: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
        limit: 50,
      })
      // @ts-expect-error
      expectType<Params>({ feed: 123, limit: 50 })
      // @ts-expect-error
      expectType<Params>({ limit: 50 })
    })
  })

  describe('procedure', () => {
    test('infers parameter types', () => {
      const procedure = l.procedure(
        'com.example.list',
        l.params({ limit: l.string() }),
        l.payload(undefined, undefined),
        l.payload(undefined, undefined),
        undefined,
      )

      type Params = l.InferMethodParams<typeof procedure>

      expectType<Params>({ limit: '10' })
      // @ts-expect-error
      expectType<Params>({ limit: 10 })
      // @ts-expect-error
      expectType<Params>({ limit: binaryValue })
      // @ts-expect-error
      expectType<Params>(binaryValue)
    })
  })

  describe('subscription', () => {
    test('infers parameter types', () => {
      const subscription = l.subscription(
        'com.example.subscribe',
        l.params({
          cursor: l.optional(l.integer()),
        }),
        l.unknown(),
      )

      type Params = l.InferMethodParams<typeof subscription>

      expectType<Params>({ cursor: 100 })
      // @ts-expect-error
      expectType<Params>({ cursor: '100' })
      // @ts-expect-error
      expectType<Params>({ cursor: binaryValue })
    })
  })
})

describe('InferMethodInput', () => {
  describe('procedure', () => {
    test('with payload schema', () => {
      const procedure = l.procedure(
        'com.example.create',
        l.params(),
        l.payload('application/json', l.object({ text: l.string() })),
        l.payload(undefined, undefined),
        undefined,
      )

      type Input = l.InferMethodInput<typeof procedure, BinaryValue>

      expectType<Input>({ encoding: 'application/json', body: { text: 'hi' } })
      // @ts-expect-error
      expectType<Input>({ encoding: 'application/json', body: { text: 123 } })
      // @ts-expect-error
      expectType<Input>({ encoding: 'text/plain', body: 'hello' })
      // @ts-expect-error
      expectType<Input>({ encoding: 'text/plain', body: new Uint8Array() })
      // @ts-expect-error
      expectType<Input>({ encoding: 'text/plain', body: binaryValue })
    })

    test('without payload schema', () => {
      const procedure = l.procedure(
        'com.example.create',
        l.params(),
        l.payload('*/*', undefined),
        l.payload(undefined, undefined),
        undefined,
      )

      type Input = l.InferMethodInput<typeof procedure, BinaryValue>

      expectType<Input>({ encoding: 'image/png', body: binaryValue })
      // @ts-expect-error
      expectType<Input>({ encoding: 'image/png', body: new Uint8Array() })
      // @ts-expect-error
      expectType<Input>({ encoding: 'image/png', body: [] })
      // @ts-expect-error
      expectType<Input>({ encoding: 'image/png', body: 'foo' })
    })
  })
})

describe('InferMethodInputBody', () => {
  describe('procedure', () => {
    test('with payload schema', () => {
      const procedure = l.procedure(
        'com.example.create',
        l.params(),
        l.payload('application/json', l.object({ text: l.string() })),
        l.payload(undefined, undefined),
        undefined,
      )

      type InputBody = l.InferMethodInputBody<typeof procedure, BinaryValue>

      expectType<InputBody>({ text: 'hello' })
      // @ts-expect-error
      expectType<InputBody>({ text: 123 })
      // @ts-expect-error
      expectType<InputBody>(binaryValue)
    })

    test('without payload schema', () => {
      const procedure = l.procedure(
        'com.example.upload',
        l.params(),
        l.payload('*/*', undefined),
        l.payload(undefined, undefined),
        undefined,
      )

      type InputBody = l.InferMethodInputBody<typeof procedure, BinaryValue>

      expectType<InputBody>(binaryValue)
      // @ts-expect-error
      expectType<InputBody>(new Uint8Array())
      // @ts-expect-error
      expectType<InputBody>({ text: 'hello' })
    })
  })
})

describe('InferMethodInputEncoding', () => {
  describe('procedure', () => {
    test('with payload schema', () => {
      const procedure = l.procedure(
        'com.example.create',
        l.params(),
        l.payload('application/json', l.object({ text: l.string() })),
        l.payload(undefined, undefined),
        undefined,
      )

      type InputEncoding = l.InferMethodInputEncoding<typeof procedure>

      expectType<InputEncoding>('application/json')
      // @ts-expect-error
      expectType<InputEncoding>('text/plain')
      // @ts-expect-error
      expectType<InputEncoding>(123)
    })

    test('without payload schema', () => {
      const procedure = l.procedure(
        'com.example.upload',
        l.params(),
        l.payload('*/*', undefined),
        l.payload(undefined, undefined),
        undefined,
      )

      type InputEncoding = l.InferMethodInputEncoding<typeof procedure>

      expectType<InputEncoding>('image/png')
      expectType<InputEncoding>('application/octet-stream')
      // @ts-expect-error
      expectType<InputEncoding>(123)
    })
  })
})

describe('InferMethodOutput', () => {
  describe('query', () => {
    test('with payload schema', () => {
      const query = l.query(
        'com.example.query',
        l.params(),
        l.payload('application/json', l.object({ items: l.array(l.string()) })),
      )

      type Output = l.InferMethodOutput<typeof query, BinaryValue>

      expectType<Output>({ encoding: 'application/json', body: { items: [] } })
      // @ts-expect-error
      expectType<Output>({ encoding: 'application/json', body: { items: [1] } })
      // @ts-expect-error
      expectType<Output>({ encoding: 'text/plain', body: { items: [] } })
    })

    test('without payload schema', () => {
      const query = l.query(
        'com.example.query',
        l.params(),
        l.payload('*/*', undefined),
      )

      type Output = l.InferMethodOutput<typeof query, BinaryValue>

      expectType<Output>({ encoding: 'image/png', body: binaryValue })
      // @ts-expect-error
      expectType<Output>({ encoding: 'image/png', body: new Uint8Array() })
      // @ts-expect-error
      expectType<Output>({ encoding: 'image/png', body: 'string' })
    })
  })

  describe('procedure', () => {
    test('with payload schema', () => {
      const procedure = l.procedure(
        'com.example.create',
        l.params(),
        l.payload(undefined, undefined),
        l.payload(
          'application/json',
          l.object({ uri: l.string({ format: 'at-uri' }) }),
        ),
        undefined,
      )

      type Output = l.InferMethodOutput<typeof procedure, BinaryValue>

      expectType<Output>({
        encoding: 'application/json',
        body: { uri: 'at://did:plc:abc/post/123' },
      })
      // @ts-expect-error
      expectType<Output>({ encoding: 'application/json', body: { uri: 123 } })
      // @ts-expect-error
      expectType<Output>({ encoding: 'text/plain', body: { uri: 'at://...' } })
      // @ts-expect-error
      expectType<Output>({ encoding: 'text/plain', body: 'Hello' })
    })

    test('without payload schema', () => {
      const procedure = l.procedure(
        'com.example.export',
        l.params(),
        l.payload(undefined, undefined),
        l.payload('*/*', undefined),
        undefined,
      )

      type Output = l.InferMethodOutput<typeof procedure, BinaryValue>

      expectType<Output>({
        encoding: 'application/zip',
        body: binaryValue,
      })
      expectType<Output>({
        encoding: 'application/zip',
        // @ts-expect-error
        body: new Uint8Array(),
      })
      // @ts-expect-error
      expectType<Output>({ encoding: 'application/zip', body: 'string' })
    })
  })
})

describe('InferMethodOutputBody', () => {
  describe('query', () => {
    test('with payload schema', () => {
      const query = l.query(
        'com.example.query',
        l.params(),
        l.payload(
          'application/json',
          l.object({
            cursor: l.optional(l.string()),
            feed: l.string({ format: 'at-uri' }),
          }),
        ),
      )

      type OutputBody = l.InferMethodOutputBody<typeof query, BinaryValue>

      expectType<OutputBody>({
        cursor: 'abc123',
        feed: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
      })
      // @ts-expect-error
      expectType<OutputBody>({ cursor: 123, feed: 'at://...' })
      // @ts-expect-error
      expectType<OutputBody>({ feed: 123 })
    })

    test('without payload schema', () => {
      const query = l.query(
        'com.example.query',
        l.params(),
        l.payload('*/*', undefined),
      )

      type OutputBody = l.InferMethodOutputBody<typeof query, BinaryValue>

      expectType<OutputBody>(binaryValue)
      // @ts-expect-error
      expectType<OutputBody>(new Uint8Array())
      // @ts-expect-error
      expectType<OutputBody>({ data: 'foo' })
    })
  })

  describe('procedure', () => {
    test('with payload schema', () => {
      const procedure = l.procedure(
        'com.example.get',
        l.params(),
        l.payload(undefined, undefined),
        l.payload(
          'application/json',
          l.object({ uri: l.string({ format: 'at-uri' }) }),
        ),
        undefined,
      )

      type OutputBody = l.InferMethodOutputBody<typeof procedure, BinaryValue>

      expectType<OutputBody>({ uri: 'at://did:plc:abc/post/123' })
      // @ts-expect-error
      expectType<OutputBody>({ uri: 123 })
      // @ts-expect-error
      expectType<OutputBody>(binaryValue)
    })

    test('without payload schema', () => {
      const procedure = l.procedure(
        'com.example.export',
        l.params(),
        l.payload(undefined, undefined),
        l.payload('*/*', undefined),
        undefined,
      )

      type OutputBody = l.InferMethodOutputBody<typeof procedure, BinaryValue>

      expectType<OutputBody>(binaryValue)
      // @ts-expect-error
      expectType<OutputBody>(new Uint8Array())
      // @ts-expect-error
      expectType<OutputBody>({ data: 'foo' })
    })
  })
})

describe('InferMethodOutputEncoding', () => {
  describe('query', () => {
    test('with payload schema', () => {
      const query = l.query(
        'com.example.query',
        l.params(),
        l.payload('application/json', l.object({ data: l.string() })),
      )

      type OutputEncoding = l.InferMethodOutputEncoding<typeof query>

      expectType<OutputEncoding>('application/json')
      // @ts-expect-error
      expectType<OutputEncoding>('text/plain')
      // @ts-expect-error
      expectType<OutputEncoding>(123)
    })

    test('without payload schema', () => {
      const query = l.query(
        'com.example.query',
        l.params(),
        l.payload('*/*', undefined),
      )

      type OutputEncoding = l.InferMethodOutputEncoding<typeof query>

      expectType<OutputEncoding>('image/png')
      expectType<OutputEncoding>('application/octet-stream')
      // @ts-expect-error
      expectType<OutputEncoding>(123)
    })
  })

  describe('procedure', () => {
    test('with payload schema', () => {
      const procedure = l.procedure(
        'com.example.create',
        l.params(),
        l.payload(undefined, undefined),
        l.payload('application/json', l.object({ id: l.string() })),
        undefined,
      )

      type OutputEncoding = l.InferMethodOutputEncoding<typeof procedure>

      expectType<OutputEncoding>('application/json')
      // @ts-expect-error
      expectType<OutputEncoding>('text/plain')
      // @ts-expect-error
      expectType<OutputEncoding>(123)
    })

    test('without payload schema', () => {
      const procedure = l.procedure(
        'com.example.export',
        l.params(),
        l.payload(undefined, undefined),
        l.payload('*/*', undefined),
        undefined,
      )

      type OutputEncoding = l.InferMethodOutputEncoding<typeof procedure>

      expectType<OutputEncoding>('application/zip')
      expectType<OutputEncoding>('application/octet-stream')
      // @ts-expect-error
      expectType<OutputEncoding>(123)
    })
  })
})

describe('InferMethodMessage', () => {
  describe('subscription', () => {
    test('with message schema', () => {
      const subscription = l.subscription(
        'com.example.subscribe',
        l.params(),
        l.object({
          seq: l.integer(),
          event: l.string(),
        }),
      )

      type Message = l.InferMethodMessage<typeof subscription>

      expectType<Message>({ seq: 1, event: 'create' })
      // @ts-expect-error
      expectType<Message>({ seq: '1', event: 'create' })
      // @ts-expect-error
      expectType<Message>({ seq: 1 })
      // @ts-expect-error
      expectType<Message>(binaryValue)
    })

    test('without message schema', () => {
      const subscription = l.subscription(
        'com.example.subscribe',
        l.params(),
        l.unknown(),
      )

      type Message = l.InferMethodMessage<typeof subscription>

      // @ts-expect-error "unknown" is turned into LexValue
      expectType<Message>(undefined)
      expectType<Message>({ any: 'value' })
      expectType<Message>(123)
    })
  })
})

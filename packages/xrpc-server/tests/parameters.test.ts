import * as http from 'node:http'
import { AddressInfo } from 'node:net'
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import * as xrpcServer from '../src'
import { buildAddLexicons, closeServer, createServer } from './_util'

const LEXICONS: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'io.example.paramTest',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['str', 'int', 'bool', 'arr'],
          properties: {
            str: { type: 'string', minLength: 2, maxLength: 10 },
            int: { type: 'integer', minimum: 2, maximum: 10 },
            bool: { type: 'boolean' },
            arr: { type: 'array', items: { type: 'integer' }, maxLength: 2 },
            def: { type: 'integer', default: 0 },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
]

describe('Parameters', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.paramTest', (ctx) => ({
    encoding: 'json',
    body: ctx.params,
  }))

  let client: XrpcClient
  beforeAll(async () => {
    s = await createServer(server)
    const { port } = s.address() as AddressInfo
    client = new XrpcClient(`http://localhost:${port}`, LEXICONS)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('validates query params', async () => {
    const res1 = await client.call('io.example.paramTest', {
      str: 'valid',
      int: 5,
      bool: true,
      arr: [1, 2],
      def: 5,
    })
    expect(res1.success).toBeTruthy()
    expect(res1.data.str).toBe('valid')
    expect(res1.data.int).toBe(5)
    expect(res1.data.bool).toBe(true)
    expect(res1.data.arr).toEqual([1, 2])
    expect(res1.data.def).toEqual(5)

    const res2 = await client.call('io.example.paramTest', {
      str: 10,
      int: '5',
      bool: 'foo',
      arr: '3',
    })
    expect(res2.success).toBeTruthy()
    expect(res2.data.str).toBe('10')
    expect(res2.data.int).toBe(5)
    expect(res2.data.bool).toBe(true)
    expect(res2.data.arr).toEqual([3])
    expect(res2.data.def).toEqual(0)

    // @TODO test sending blatantly bad types
    await expect(
      client.call('io.example.paramTest', {
        str: 'n',
        int: 5,
        bool: true,
        arr: [1],
      }),
    ).rejects.toThrow('str must not be shorter than 2 characters')
    await expect(
      client.call('io.example.paramTest', {
        str: 'loooooooooooooong',
        int: 5,
        bool: true,
        arr: [1],
      }),
    ).rejects.toThrow('str must not be longer than 10 characters')
    await expect(
      client.call('io.example.paramTest', {
        int: 5,
        bool: true,
        arr: [1],
      }),
    ).rejects.toThrow(`Params must have the property "str"`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: -1,
        bool: true,
        arr: [1],
      }),
    ).rejects.toThrow('int can not be less than 2')
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 11,
        bool: true,
        arr: [1],
      }),
    ).rejects.toThrow('int can not be greater than 10')
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        bool: true,
        arr: [1],
      }),
    ).rejects.toThrow(`Params must have the property "int"`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        arr: [1],
      }),
    ).rejects.toThrow(`Params must have the property "bool"`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        bool: true,
        arr: [],
      }),
    ).rejects.toThrow('Error: Params must have the property "arr"')
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        bool: true,
        arr: [1, 2, 3],
      }),
    ).rejects.toThrow('Error: arr must not have more than 2 elements')
  })
})

const LOOSE_PARAMS_LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.looseParamsTest',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['str'],
          properties: {
            str: { type: 'string' },
            arr: { type: 'array', items: { type: 'string' } },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
] as const satisfies LexiconDoc[]

describe('paramsParseLoose', () => {
  let s: http.Server
  let url: string

  beforeAll(async () => {
    const server = await buildAddLexicons(LOOSE_PARAMS_LEXICONS, {
      'io.example.looseParamsTest': {
        opts: { paramsParseLoose: true },
        handler: (ctx: xrpcServer.HandlerContext) => ({
          encoding: 'application/json',
          body: ctx.params,
        }),
      },
    })
    s = await createServer(server)
    const { port } = s.address() as AddressInfo
    url = `http://localhost:${port}`
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('converts bracket[] array syntax to standard params', async () => {
    const res = await fetch(
      `${url}/xrpc/io.example.looseParamsTest?str=hello&arr[]=one&arr[]=two`,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.str).toBe('hello')
    expect(body.arr).toEqual(['one', 'two'])
  })

  it('still handles standard array syntax', async () => {
    const res = await fetch(
      `${url}/xrpc/io.example.looseParamsTest?str=hello&arr=one&arr=two`,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.str).toBe('hello')
    expect(body.arr).toEqual(['one', 'two'])
  })

  it('handles single bracket value', async () => {
    const res = await fetch(
      `${url}/xrpc/io.example.looseParamsTest?str=hello&arr[]=only`,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.str).toBe('hello')
    expect(body.arr).toEqual(['only'])
  })

  it('throws when used with method()', () => {
    const server = xrpcServer.createServer(LOOSE_PARAMS_LEXICONS)
    expect(() => {
      server.method('io.example.looseParamsTest', {
        opts: { paramsParseLoose: true },
        handler: () => ({
          encoding: 'application/json',
          body: {},
        }),
      })
    }).toThrow('paramsParseLoose is not supported with method()')
    expect(() => {
      server.method('io.example.looseParamsTest', {
        opts: { paramsParseLoose: false },
        handler: () => ({
          encoding: 'application/json',
          body: {},
        }),
      })
    }).toThrow('paramsParseLoose is not supported with method()')
  })

  it('does not use loose parsing by default', async () => {
    const server = await buildAddLexicons(LOOSE_PARAMS_LEXICONS, {
      'io.example.looseParamsTest': (ctx: xrpcServer.HandlerContext) => ({
        encoding: 'application/json',
        body: ctx.params,
      }),
    })
    const strictServer = await createServer(server)
    const { port } = strictServer.address() as AddressInfo
    const strictUrl = `http://localhost:${port}`
    try {
      // standard array syntax works
      const res = await fetch(
        `${strictUrl}/xrpc/io.example.looseParamsTest?str=hello&arr=one&arr=two`,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.arr).toEqual(['one', 'two'])

      // bracket syntax is not converted without paramsParseLoose
      const bracketRes = await fetch(
        `${strictUrl}/xrpc/io.example.looseParamsTest?str=hello&arr[]=one&arr[]=two`,
      )
      expect(bracketRes.status).toBe(200)
      const bracketBody = await bracketRes.json()
      expect(bracketBody.arr).toBeUndefined()
    } finally {
      await closeServer(strictServer)
    }
  })
})

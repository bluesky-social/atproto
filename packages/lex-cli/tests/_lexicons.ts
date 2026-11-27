import type { LexiconDoc } from '@atproto/lexicon'

/**
 * Lexicon documents used only to ensure that lex-cli's output stays consistent:
 * they cover every branch of the `gen-api` and `gen-server` code generators,
 * and their generated code is snapshotted. They are not meant to be realistic.
 */
export const lexicons: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'com.example.defs',
    defs: {
      kitchenSink: {
        type: 'object',
        description: 'An object with every kind of property.',
        required: ['str', 'ref'],
        nullable: ['nullableStr', 'nullableRef'],
        properties: {
          str: { type: 'string', description: 'A plain string.' },
          knownValues: {
            type: 'string',
            knownValues: ['com.example.defs#token', 'other'],
          },
          enumStr: { type: 'string', enum: ['a', 'b'] },
          constStr: { type: 'string', const: 'fixed' },
          defaultStr: { type: 'string', default: 'dflt' },
          nullableStr: { type: 'string' },
          int: { type: 'integer', minimum: 0 },
          enumInt: { type: 'integer', enum: [1, 2] },
          constInt: { type: 'integer', const: 3 },
          bool: { type: 'boolean' },
          constBool: { type: 'boolean', const: true },
          blob: { type: 'blob', accept: ['image/*'] },
          bytes: { type: 'bytes' },
          cid: { type: 'cid-link' },
          unknown: { type: 'unknown' },
          ref: { type: 'ref', ref: '#other' },
          nullableRef: { type: 'ref', ref: 'com.example.feed.post#entity' },
          externalRef: { type: 'ref', ref: 'org.sample.thing' },
          openUnion: {
            type: 'union',
            refs: ['#other', 'com.example.feed.post#entity'],
          },
          closedUnion: { type: 'union', refs: ['#other'], closed: true },
          refArray: {
            type: 'array',
            description: 'An array of refs.',
            items: { type: 'ref', ref: '#other' },
          },
          openUnionArray: {
            type: 'array',
            items: { type: 'union', refs: ['#other', 'org.sample.thing'] },
          },
          closedUnionArray: {
            type: 'array',
            items: { type: 'union', refs: ['#other'], closed: true },
          },
          stringArray: {
            type: 'array',
            items: { type: 'string', maxLength: 10 },
          },
          blobArray: { type: 'array', items: { type: 'blob' } },
        },
      },
      other: {
        type: 'object',
        properties: { value: { type: 'string' } },
      },
      empty: { type: 'object', properties: {} },
      token: { type: 'token', description: 'A token.' },
      undocumentedToken: { type: 'token' },
      refList: { type: 'array', items: { type: 'ref', ref: '#other' } },
      openUnionList: {
        type: 'array',
        items: { type: 'union', refs: ['#other', 'org.sample.thing'] },
      },
      closedUnionList: {
        type: 'array',
        items: { type: 'union', refs: ['#other'], closed: true },
      },
      stringList: {
        type: 'array',
        description: 'A list of strings.',
        items: { type: 'string' },
      },
      string: {
        type: 'string',
        description: 'A string.',
        knownValues: ['x', 'y'],
      },
      integer: { type: 'integer' },
      boolean: { type: 'boolean' },
      blob: { type: 'blob' },
      bytes: { type: 'bytes' },
      cidLink: { type: 'cid-link' },
      unknown: { type: 'unknown' },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.token',
    defs: {
      main: { type: 'token', description: 'A main token.' },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.auth',
    defs: {
      main: {
        type: 'permission-set',
        permissions: [
          {
            type: 'permission',
            resource: 'repo',
            collection: ['com.example.feed.post'],
          },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.feed.post',
    defs: {
      main: {
        type: 'record',
        description: 'A post.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['text', 'createdAt'],
          properties: {
            text: { type: 'string', maxLength: 300 },
            entities: {
              type: 'array',
              items: { type: 'ref', ref: '#entity' },
            },
            embed: {
              type: 'union',
              refs: ['com.example.defs#other', 'org.sample.thing'],
            },
            createdAt: { type: 'string', format: 'datetime' },
          },
        },
      },
      entity: {
        type: 'object',
        required: ['index'],
        properties: { index: { type: 'integer' } },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.actor.profile',
    defs: {
      main: {
        type: 'record',
        key: 'literal:self',
        record: {
          type: 'object',
          properties: {
            displayName: { type: 'string' },
            avatar: { type: 'blob', accept: ['image/png'] },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.feed.getPosts',
    defs: {
      main: {
        type: 'query',
        description: 'Get posts.',
        parameters: {
          type: 'params',
          description: 'The query parameters.',
          required: ['uris'],
          properties: {
            uris: {
              type: 'array',
              description: 'The post URIs.',
              items: { type: 'string', format: 'at-uri' },
            },
            limit: { type: 'integer', default: 50 },
            sort: { type: 'string', knownValues: ['new', 'old'] },
            cursor: { type: 'string' },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['posts'],
            properties: {
              posts: {
                type: 'array',
                items: { type: 'ref', ref: 'com.example.feed.post#entity' },
              },
              cursor: { type: 'string' },
            },
          },
        },
        errors: [
          { name: 'NotFound' },
          { name: 'BlockedError', description: 'Blocked.' },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.feed.getThread',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'union',
            refs: ['#threadView', 'com.example.defs#other'],
          },
        },
      },
      threadView: {
        type: 'object',
        properties: {
          replies: {
            type: 'array',
            items: { type: 'union', refs: ['#threadView'] },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.feed.thread.mute',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['root'],
            properties: { root: { type: 'string', format: 'at-uri' } },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.feed.createPost',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: { type: 'ref', ref: 'com.example.feed.post' },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri'],
            properties: { uri: { type: 'string', format: 'at-uri' } },
          },
        },
        errors: [{ name: 'InvalidPost' }],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.feed.react',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'union',
            refs: ['com.example.defs#other', 'org.sample.thing'],
            closed: true,
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.feed.ping',
    defs: {
      main: { type: 'procedure' },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.blob.upload',
    defs: {
      main: {
        type: 'procedure',
        input: { encoding: '*/*' },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['blob'],
            properties: { blob: { type: 'blob' } },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.blob.download',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['cid'],
          properties: { cid: { type: 'string', format: 'cid' } },
        },
        output: { encoding: 'application/octet-stream' },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.blob.convert',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json, application/cbor',
          schema: { type: 'ref', ref: 'com.example.defs#other' },
        },
        output: {
          encoding: 'application/json, application/cbor',
          schema: { type: 'ref', ref: 'com.example.defs#other' },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.sync.subscribe',
    defs: {
      main: {
        type: 'subscription',
        parameters: {
          type: 'params',
          properties: { cursor: { type: 'integer' } },
        },
        message: {
          schema: { type: 'union', refs: ['#commit', '#info'] },
        },
        errors: [{ name: 'FutureCursor' }],
      },
      commit: {
        type: 'object',
        required: ['seq'],
        properties: { seq: { type: 'integer' } },
      },
      info: {
        type: 'object',
        properties: { name: { type: 'string', knownValues: ['Outdated'] } },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.sync.listen',
    defs: {
      main: {
        type: 'subscription',
        message: { schema: { type: 'union', refs: [] } },
      },
    },
  },
  {
    lexicon: 1,
    id: 'org.sample.thing',
    defs: {
      main: {
        type: 'object',
        properties: {
          kitchenSink: { type: 'ref', ref: 'com.example.defs#kitchenSink' },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'org.sample.getThing',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
          schema: { type: 'ref', ref: 'org.sample.thing' },
        },
      },
    },
  },
]

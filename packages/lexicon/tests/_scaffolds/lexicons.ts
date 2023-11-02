import { LexiconDoc } from '../../src/index'

const lexicons: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'com.example.kitchenSink',
    defs: {
      main: {
        type: 'record',
        description: 'A record',
        key: 'tid',
        record: {
          type: 'object',
          required: [
            'object',
            'array',
            'boolean',
            'integer',
            'string',
            'bytes',
            'cidLink',
          ],
          properties: {
            object: { type: 'ref', ref: '#object' },
            array: { type: 'array', items: { type: 'string' } },
            boolean: { type: 'boolean' },
            integer: { type: 'integer' },
            string: { type: 'string' },
            bytes: { type: 'bytes' },
            cidLink: { type: 'cid-link' },
          },
        },
      },
      object: {
        type: 'object',
        required: ['object', 'array', 'boolean', 'integer', 'string'],
        properties: {
          object: { type: 'ref', ref: '#subobject' },
          array: { type: 'array', items: { type: 'string' } },
          boolean: { type: 'boolean' },
          integer: { type: 'integer' },
          string: { type: 'string' },
        },
      },
      subobject: {
        type: 'object',
        required: ['boolean'],
        properties: {
          boolean: { type: 'boolean' },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.query',
    defs: {
      main: {
        type: 'query',
        description: 'A query',
        parameters: {
          type: 'params',
          required: ['boolean', 'integer'],
          properties: {
            boolean: { type: 'boolean' },
            integer: { type: 'integer' },
            string: { type: 'string' },
            array: { type: 'array', items: { type: 'string' } },
            def: { type: 'integer', default: 0 },
          },
        },
        output: {
          encoding: 'application/json',
          schema: { type: 'ref', ref: 'com.example.kitchenSink#object' },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.procedure',
    defs: {
      main: {
        type: 'procedure',
        description: 'A procedure',
        parameters: {
          type: 'params',
          required: ['boolean', 'integer'],
          properties: {
            boolean: { type: 'boolean' },
            integer: { type: 'integer' },
            string: { type: 'string' },
            array: { type: 'array', items: { type: 'string' } },
          },
        },
        input: {
          encoding: 'application/json',
          schema: { type: 'ref', ref: 'com.example.kitchenSink#object' },
        },
        output: {
          encoding: 'application/json',
          schema: { type: 'ref', ref: 'com.example.kitchenSink#object' },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.optional',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            object: { type: 'ref', ref: 'com.example.kitchenSink#object' },
            array: { type: 'array', items: { type: 'string' } },
            boolean: { type: 'boolean' },
            integer: { type: 'integer' },
            string: { type: 'string' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.default',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          required: ['boolean'],
          properties: {
            boolean: { type: 'boolean', default: false },
            integer: { type: 'integer', default: 0 },
            string: { type: 'string', default: '' },
            object: { type: 'ref', ref: '#object' },
          },
        },
      },
      object: {
        type: 'object',
        properties: {
          boolean: { type: 'boolean', default: true },
          integer: { type: 'integer', default: 1 },
          string: { type: 'string', default: 'x' },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.union',
    defs: {
      main: {
        type: 'record',
        description: 'A record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['unionOpen', 'unionClosed'],
          properties: {
            unionOpen: {
              type: 'union',
              refs: [
                'com.example.kitchenSink#object',
                'com.example.kitchenSink#subobject',
              ],
            },
            unionClosed: {
              type: 'union',
              closed: true,
              refs: [
                'com.example.kitchenSink#object',
                'com.example.kitchenSink#subobject',
              ],
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.unknown',
    defs: {
      main: {
        type: 'record',
        description: 'A record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['unknown'],
          properties: {
            unknown: { type: 'unknown' },
            optUnknown: { type: 'unknown' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.arrayLength',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            array: {
              type: 'array',
              minLength: 2,
              maxLength: 4,
              items: { type: 'integer' },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.boolConst',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            boolean: {
              type: 'boolean',
              const: false,
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.integerRange',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            integer: {
              type: 'integer',
              minimum: 2,
              maximum: 4,
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.integerEnum',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            integer: {
              type: 'integer',
              enum: [1, 2],
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.integerConst',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            integer: {
              type: 'integer',
              const: 0,
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.stringLength',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            string: {
              type: 'string',
              minLength: 2,
              maxLength: 4,
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.stringLengthGrapheme',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            string: {
              type: 'string',
              minGraphemes: 2,
              maxGraphemes: 4,
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.stringEnum',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            string: {
              type: 'string',
              enum: ['a', 'b'],
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.stringConst',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            string: {
              type: 'string',
              const: 'a',
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.datetime',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            datetime: { type: 'string', format: 'datetime' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.uri',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            uri: { type: 'string', format: 'uri' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.atUri',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            atUri: { type: 'string', format: 'at-uri' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.did',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            did: { type: 'string', format: 'did' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.handle',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            handle: { type: 'string', format: 'handle' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.atIdentifier',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            atIdentifier: { type: 'string', format: 'at-identifier' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.nsid',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            nsid: { type: 'string', format: 'nsid' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.cid',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            cid: { type: 'string', format: 'cid' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.language',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            language: { type: 'string', format: 'language' },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.byteLength',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            bytes: {
              type: 'bytes',
              minLength: 2,
              maxLength: 4,
            },
          },
        },
      },
    },
  },
]

export default lexicons

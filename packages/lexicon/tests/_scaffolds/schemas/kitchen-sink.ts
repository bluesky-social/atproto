export default {
  lexicon: 1,
  id: 'com.example.kitchenSink',
  defs: {
    main: {
      type: 'token',
    },
    record: {
      type: 'record',
      description: 'A record',
      key: 'tid',
      record: {
        type: 'object',
        required: [
          'object',
          'array',
          'boolean',
          'number',
          'integer',
          'string',
          'datetime',
        ],
        properties: {
          object: '#object',
          array: { type: 'array', items: { type: 'string' } },
          boolean: { type: 'boolean' },
          number: { type: 'number' },
          integer: { type: 'integer' },
          string: { type: 'string' },
          datetime: { type: 'datetime' },
        },
      },
    },
    query: {
      type: 'query',
      description: 'A query',
      parameters: {
        boolean: { type: 'boolean' },
        number: { type: 'number' },
        integer: { type: 'integer' },
        string: { type: 'string' },
      },
      output: {
        encoding: 'application/json',
        schema: '#object',
      },
    },
    procedure: {
      type: 'procedure',
      description: 'A procedure',
      parameters: {
        boolean: { type: 'boolean' },
        number: { type: 'number' },
        integer: { type: 'integer' },
        string: { type: 'string' },
      },
      input: {
        encoding: 'application/json',
        schema: '#object',
      },
      output: {
        encoding: 'application/json',
        schema: '#object',
      },
    },
    object: {
      type: 'object',
      required: ['object', 'array', 'boolean', 'number', 'integer', 'string'],
      properties: {
        object: '#subobject',
        array: { type: 'array', items: { type: 'string' } },
        boolean: { type: 'boolean' },
        number: { type: 'number' },
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
    optional: {
      type: 'record',
      record: {
        type: 'object',
        properties: {
          object: '#object',
          array: { type: 'array', items: { type: 'string' } },
          boolean: { type: 'boolean' },
          number: { type: 'number' },
          integer: { type: 'integer' },
          string: { type: 'string' },
        },
      },
    },
    unknown: {
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
    arrayLength: {
      type: 'record',
      record: {
        type: 'object',
        properties: {
          array: {
            type: 'array',
            minLength: 2,
            maxLength: 4,
            items: { type: 'number' },
          },
        },
      },
    },
    boolConst: {
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
    numberRange: {
      type: 'record',
      record: {
        type: 'object',
        properties: {
          number: {
            type: 'number',
            minimum: 2,
            maximum: 4,
          },
        },
      },
    },
    numberEnum: {
      type: 'record',
      record: {
        type: 'object',
        properties: {
          number: {
            type: 'number',
            enum: [1, 1.5, 2],
          },
        },
      },
    },
    numberConst: {
      type: 'record',
      record: {
        type: 'object',
        properties: {
          number: {
            type: 'number',
            const: 0,
          },
        },
      },
    },
    integerRange: {
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
    integerEnum: {
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
    integerConst: {
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
    stringLength: {
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
    stringEnum: {
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
    stringConst: {
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
}

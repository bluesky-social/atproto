import { Lexicons } from '../src/index'
import LexiconDocs from './_scaffolds/lexicons'

describe('Lexicons collection', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Adds schemas', () => {
    expect(() => lex.add(LexiconDocs[0])).toThrow()
  })

  it('Correctly references all definitions', () => {
    expect(lex.getDef('com.example.kitchenSink')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('lex:com.example.kitchenSink')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#main')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#main')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#object')).toEqual(
      LexiconDocs[0].defs.object,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#object')).toEqual(
      LexiconDocs[0].defs.object,
    )
  })
})

describe('General validation', () => {
  const lex = new Lexicons(LexiconDocs)
  it('Validates records correctly', () => {
    {
      const res = lex.validate('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: true },
          array: ['one', 'two'],
          boolean: true,
          number: 123.45,
          integer: 123,
          string: 'string',
        },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
      })
      expect(res.success).toBe(true)
    }
    {
      const res = lex.validate('com.example.kitchenSink', {})
      expect(res.success).toBe(false)
      expect(res.error?.message).toBe('Record must have the property "object"')
    }
  })
  it('Validates objects correctly', () => {
    {
      const res = lex.validate('com.example.kitchenSink#object', {
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
      })
      expect(res.success).toBe(true)
    }
    {
      const res = lex.validate('com.example.kitchenSink#object', {})
      expect(res.success).toBe(false)
      expect(res.error?.message).toBe('Object must have the property "object"')
    }
  })
})

describe('Record validation', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Passes valid schemas', () => {
    lex.assertValidRecord('com.example.kitchenSink', {
      $type: 'com.example.kitchenSink',
      object: {
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
      },
      array: ['one', 'two'],
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
      datetime: new Date().toISOString(),
    })
  })

  it('Fails invalid input types', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', undefined),
    ).toThrow('Record must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', 1234),
    ).toThrow('Record must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', 'string'),
    ).toThrow('Record must be an object')
  })

  it('Fails incorrect $type', () => {
    expect(() => lex.assertValidRecord('com.example.kitchenSink', {})).toThrow(
      'Record/$type must be a string',
    )
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', { $type: 'foo' }),
    ).toThrow('Invalid $type: must be lex:com.example.kitchenSink, got foo')
  })

  it('Fails missing required', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record must have the property "object"')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: undefined,
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record must have the property "object"')
  })

  it('Fails incorrect types', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: '1234' },
          array: ['one', 'two'],
          boolean: true,
          number: 123.45,
          integer: 123,
          string: 'string',
        },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record/object/object/boolean must be a boolean')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: true,
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record/object must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: true },
          array: ['one', 'two'],
          boolean: true,
          number: 123.45,
          integer: 123,
          string: 'string',
        },
        array: 1234,
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record/array must be an array')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: true },
          array: ['one', 'two'],
          boolean: true,
          number: 123.45,
          integer: 123,
          string: 'string',
        },
        array: ['one', 'two'],
        boolean: true,
        number: 'string',
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record/number must be a number')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: true },
          array: ['one', 'two'],
          boolean: true,
          number: 123.45,
          integer: 123,
          string: 'string',
        },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: true,
        string: 'string',
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record/integer must be a number')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: true },
          array: ['one', 'two'],
          boolean: true,
          number: 123.45,
          integer: 123,
          string: 'string',
        },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: {},
        datetime: new Date().toISOString(),
      }),
    ).toThrow('Record/string must be a string')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: true },
          array: ['one', 'two'],
          boolean: true,
          number: 123.45,
          integer: 123,
          string: 'string',
        },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        datetime: 1234,
      }),
    ).toThrow('Record/datetime must be a string')
  })

  it('Handles optional properties correctly', () => {
    lex.assertValidRecord('com.example.optional', {
      $type: 'com.example.optional',
    })
  })

  it('Handles unions correctly', () => {
    lex.assertValidRecord('com.example.union', {
      $type: 'com.example.union',
      unionOpen: {
        $type: 'com.example.kitchenSink#object',
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
      },
      unionClosed: {
        $type: 'com.example.kitchenSink#subobject',
        boolean: true,
      },
    })
    lex.assertValidRecord('com.example.union', {
      $type: 'com.example.union',
      unionOpen: {
        $type: 'com.example.other',
      },
      unionClosed: {
        $type: 'com.example.kitchenSink#subobject',
        boolean: true,
      },
    })
    expect(() =>
      lex.assertValidRecord('com.example.union', {
        $type: 'com.example.union',
        unionOpen: {},
        unionClosed: {},
      }),
    ).toThrow(
      'Record/unionOpen must be an object which includes the "$type" property',
    )
    expect(() =>
      lex.assertValidRecord('com.example.union', {
        $type: 'com.example.union',
        unionOpen: {
          $type: 'com.example.other',
        },
        unionClosed: {
          $type: 'com.example.other',
          boolean: true,
        },
      }),
    ).toThrow(
      'Record/unionClosed $type must be one of lex:com.example.kitchenSink#object, lex:com.example.kitchenSink#subobject',
    )
  })

  it('Handles unknowns correctly', () => {
    lex.assertValidRecord('com.example.unknown', {
      $type: 'com.example.unknown',
      unknown: { foo: 'bar' },
    })
    expect(() =>
      lex.assertValidRecord('com.example.unknown', {
        $type: 'com.example.unknown',
      }),
    ).toThrow('Record must have the property "unknown"')
  })

  it('Applies array length constraints', () => {
    lex.assertValidRecord('com.example.arrayLength', {
      $type: 'com.example.arrayLength',
      array: [1, 2, 3],
    })
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1],
      }),
    ).toThrow('Record/array must not have fewer than 2 elements')
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1, 2, 3, 4, 5],
      }),
    ).toThrow('Record/array must not have more than 4 elements')
  })

  it('Applies array item constraints', () => {
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1, '2', 3],
      }),
    ).toThrow('Record/array/1 must be a number')
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1, undefined, 3],
      }),
    ).toThrow('Record/array/1 must be a number')
  })

  it('Applies boolean const constraint', () => {
    lex.assertValidRecord('com.example.boolConst', {
      $type: 'com.example.boolConst',
      boolean: false,
    })
    expect(() =>
      lex.assertValidRecord('com.example.boolConst', {
        $type: 'com.example.boolConst',
        boolean: true,
      }),
    ).toThrow('Record/boolean must be false')
  })

  it('Applies number range constraint', () => {
    lex.assertValidRecord('com.example.numberRange', {
      $type: 'com.example.numberRange',
      number: 2.5,
    })
    expect(() =>
      lex.assertValidRecord('com.example.numberRange', {
        $type: 'com.example.numberRange',
        number: 1,
      }),
    ).toThrow('Record/number can not be less than 2')
    expect(() =>
      lex.assertValidRecord('com.example.numberRange', {
        $type: 'com.example.numberRange',
        number: 5,
      }),
    ).toThrow('Record/number can not be greater than 4')
  })

  it('Applies number enum constraint', () => {
    lex.assertValidRecord('com.example.numberEnum', {
      $type: 'com.example.numberEnum',
      number: 1.5,
    })
    expect(() =>
      lex.assertValidRecord('com.example.numberEnum', {
        $type: 'com.example.numberEnum',
        number: 0,
      }),
    ).toThrow('Record/number must be one of (1|1.5|2)')
  })

  it('Applies number const constraint', () => {
    lex.assertValidRecord('com.example.numberConst', {
      $type: 'com.example.numberConst',
      number: 0,
    })
    expect(() =>
      lex.assertValidRecord('com.example.numberConst', {
        $type: 'com.example.numberConst',
        number: 1,
      }),
    ).toThrow('Record/number must be 0')
  })

  it('Applies integer range constraint', () => {
    lex.assertValidRecord('com.example.integerRange', {
      $type: 'com.example.integerRange',
      integer: 2,
    })
    expect(() =>
      lex.assertValidRecord('com.example.integerRange', {
        $type: 'com.example.integerRange',
        integer: 1,
      }),
    ).toThrow('Record/integer can not be less than 2')
    expect(() =>
      lex.assertValidRecord('com.example.integerRange', {
        $type: 'com.example.integerRange',
        integer: 5,
      }),
    ).toThrow('Record/integer can not be greater than 4')
  })

  it('Applies integer enum constraint', () => {
    lex.assertValidRecord('com.example.integerEnum', {
      $type: 'com.example.integerEnum',
      integer: 2,
    })
    expect(() =>
      lex.assertValidRecord('com.example.integerEnum', {
        $type: 'com.example.integerEnum',
        integer: 0,
      }),
    ).toThrow('Record/integer must be one of (1|2)')
  })

  it('Applies integer const constraint', () => {
    lex.assertValidRecord('com.example.integerConst', {
      $type: 'com.example.integerConst',
      integer: 0,
    })
    expect(() =>
      lex.assertValidRecord('com.example.integerConst', {
        $type: 'com.example.integerConst',
        integer: 1,
      }),
    ).toThrow('Record/integer must be 0')
  })

  it('Applies integer whole-number constraint', () => {
    expect(() =>
      lex.assertValidRecord('com.example.integerRange', {
        $type: 'com.example.integerRange',
        integer: 2.5,
      }),
    ).toThrow('Record/integer must be an integer')
  })

  it('Applies string length constraint', () => {
    lex.assertValidRecord('com.example.stringLength', {
      $type: 'com.example.stringLength',
      string: '123',
    })
    expect(() =>
      lex.assertValidRecord('com.example.stringLength', {
        $type: 'com.example.stringLength',
        string: '1',
      }),
    ).toThrow('Record/string must not be shorter than 2 characters')
    expect(() =>
      lex.assertValidRecord('com.example.stringLength', {
        $type: 'com.example.stringLength',
        string: '12345',
      }),
    ).toThrow('Record/string must not be longer than 4 characters')
  })

  it('Applies string enum constraint', () => {
    lex.assertValidRecord('com.example.stringEnum', {
      $type: 'com.example.stringEnum',
      string: 'a',
    })
    expect(() =>
      lex.assertValidRecord('com.example.stringEnum', {
        $type: 'com.example.stringEnum',
        string: 'c',
      }),
    ).toThrow('Record/string must be one of (a|b)')
  })

  it('Applies string const constraint', () => {
    lex.assertValidRecord('com.example.stringConst', {
      $type: 'com.example.stringConst',
      string: 'a',
    })
    expect(() =>
      lex.assertValidRecord('com.example.stringConst', {
        $type: 'com.example.stringConst',
        string: 'b',
      }),
    ).toThrow('Record/string must be a')
  })

  it('Applies datetime formatting constraint', () => {
    for (const datetime of [
      '2022-12-12T00:50:36.809Z',
      '2022-12-12T00:50:36Z',
      '2022-12-12T00:50:36.8Z',
      '2022-12-12T00:50:36.80Z',
      '2022-12-12T00:50:36+00:00',
      '2022-12-12T00:50:36.8+00:00',
      '2022-12-11T19:50:36-05:00',
      '2022-12-11T19:50:36.8-05:00',
      '2022-12-11T19:50:36.80-05:00',
      '2022-12-11T19:50:36.809-05:00',
    ]) {
      lex.assertValidRecord('com.example.datetime', {
        $type: 'com.example.datetime',
        datetime,
      })
    }
    expect(() =>
      lex.assertValidRecord('com.example.datetime', {
        $type: 'com.example.datetime',
        datetime: 'bad date',
      }),
    ).toThrow('Record/datetime must be an iso8601 formatted datetime')
  })
})

describe('XRPC parameter validation', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Passes valid parameters', () => {
    lex.assertValidXrpcParams('com.example.query', {
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
    })
    lex.assertValidXrpcParams('com.example.procedure', {
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
    })
  })

  it('Handles required correctly', () => {
    lex.assertValidXrpcParams('com.example.query', {
      boolean: true,
      number: 123.45,
      integer: 123,
    })
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: true,
        number: 123.45,
      }),
    ).toThrow('Params must have the property "integer"')
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: true,
        number: 123.45,
        integer: undefined,
      }),
    ).toThrow('Params must have the property "integer"')
  })

  it('Validates parameter types', () => {
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: 'string',
        number: 123.45,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcParams('com.example.procedure', {
        boolean: true,
        number: true,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('number must be a number')
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
        array: 'x',
      }),
    ).toThrow('array must be an array')
  })
})

describe('XRPC input validation', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Passes valid inputs', () => {
    lex.assertValidXrpcInput('com.example.procedure', {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
  })

  it('Validates the input', () => {
    // dont need to check this extensively since it's the same logic as tested in record validation
    expect(() =>
      lex.assertValidXrpcInput('com.example.procedure', {
        object: { boolean: 'string' },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('Input/object/boolean must be a boolean')
    expect(() => lex.assertValidXrpcInput('com.example.procedure', {})).toThrow(
      'Input must have the property "object"',
    )
  })
})

describe('XRPC output validation', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Passes valid outputs', () => {
    lex.assertValidXrpcOutput('com.example.query', {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
    lex.assertValidXrpcOutput('com.example.procedure', {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
  })

  it('Validates the output', () => {
    // dont need to check this extensively since it's the same logic as tested in record validation
    expect(() =>
      lex.assertValidXrpcOutput('com.example.query', {
        object: { boolean: 'string' },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('Output/object/boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcOutput('com.example.procedure', {}),
    ).toThrow('Output must have the property "object"')
  })
})

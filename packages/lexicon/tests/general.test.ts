import { Lexicons } from '../src/index'
import KitchenSink from './_scaffolds/schemas/kitchen-sink'

describe('Lexicons collection', () => {
  const lex = new Lexicons(KitchenSink)

  it('Adds schemas', () => {
    expect(() => lex.add(KitchenSink[0])).toThrow()
  })

  it('Correctly references all definitions', () => {
    expect(lex.getDef('com.example.kitchenSink')).toEqual(
      KitchenSink[0].defs.main,
    )
    expect(lex.getDef('lex:com.example.kitchenSink')).toEqual(
      KitchenSink[0].defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#main')).toEqual(
      KitchenSink[0].defs.main,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#main')).toEqual(
      KitchenSink[0].defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#object')).toEqual(
      KitchenSink[0].defs.object,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#object')).toEqual(
      KitchenSink[0].defs.object,
    )
  })
})

describe('Record validation', () => {
  const lex = new Lexicons(KitchenSink)

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

  it('Handles unknowns correctly', () => {
    lex.assertValidRecord('com.example.unknown', {
      $type: 'com.example.unknown',
      unknown: { foo: 'bar' },
    })
    expect(() =>
      lex.assertValidRecord('com.example.unknown', {
        $type: 'com.example.unknown',
      }),
    ).toThrow('')
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
        datetime: 'bad date',
      }),
    ).toThrow('Record/datetime must be an iso8601 formatted datetime')
  })
})

describe('XRPC parameter validation', () => {
  const lex = new Lexicons(KitchenSink)

  it('Passes valid parameters', () => {
    lex.assertValidXrpcParams('com.example.query', {
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
    lex.assertValidXrpcParams('com.example.procedure', {
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
  })

  it('Treats all parameters as optional', () => {
    lex.assertValidXrpcParams('com.example.query', {})
    lex.assertValidXrpcParams('com.example.procedure', {})
  })

  it('Validates parameter types', () => {
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: 'string',
      }),
    ).toThrow('boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcParams('com.example.procedure', {
        number: true,
      }),
    ).toThrow('number must be a number')
  })
})

describe('XRPC input validation', () => {
  const lex = new Lexicons(KitchenSink)

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
  const lex = new Lexicons(KitchenSink)

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

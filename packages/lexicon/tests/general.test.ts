import { Lexicons } from '../src/index'
import KitchenSink from './_scaffolds/schemas/kitchen-sink'

describe('Lexicons collection', () => {
  const lex = new Lexicons()

  it('Adds schemas', () => {
    lex.add(KitchenSink)
    expect(() => lex.add(KitchenSink)).toThrow()
    expect(lex.docs.size).toBe(1)
    expect(lex.defs.size).toBe(Object.keys(KitchenSink.defs).length + 1) // +1 because 'main' gets stored twice
  })

  it('Correctly references all definitions', () => {
    expect(lex.getDef('com.example.kitchenSink')).toEqual(KitchenSink.defs.main)
    expect(lex.getDef('lex:com.example.kitchenSink')).toEqual(
      KitchenSink.defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#main')).toEqual(
      KitchenSink.defs.main,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#main')).toEqual(
      KitchenSink.defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#record')).toEqual(
      KitchenSink.defs.record,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#record')).toEqual(
      KitchenSink.defs.record,
    )
  })
})

describe('Record validation', () => {
  const lex = new Lexicons()
  lex.add(KitchenSink)

  it('Passes valid schemas', () => {
    lex.assertValidRecord('com.example.kitchenSink#record', {
      $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', undefined),
    ).toThrow('Record must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#record', 1234),
    ).toThrow('Record must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#record', 'string'),
    ).toThrow('Record must be an object')
  })

  it('Fails incorrect $type', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#record', {}),
    ).toThrow('Record/$type must be a string')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#record', { $type: 'foo' }),
    ).toThrow(
      'Invalid $type: must be lex:com.example.kitchenSink#record, got foo',
    )
  })

  it('Fails missing required', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
    lex.assertValidRecord('com.example.kitchenSink#optional', {
      $type: 'com.example.kitchenSink#optional',
    })
  })

  it('Handles unknowns correctly', () => {
    lex.assertValidRecord('com.example.kitchenSink#unknown', {
      $type: 'com.example.kitchenSink#unknown',
      unknown: { foo: 'bar' },
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#unknown', {
        $type: 'com.example.kitchenSink#unknown',
      }),
    ).toThrow('')
  })

  it('Applies array length constraints', () => {
    lex.assertValidRecord('com.example.kitchenSink#arrayLength', {
      $type: 'com.example.kitchenSink#arrayLength',
      array: [1, 2, 3],
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#arrayLength', {
        $type: 'com.example.kitchenSink#arrayLength',
        array: [1],
      }),
    ).toThrow('Record/array must not have fewer than 2 elements')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#arrayLength', {
        $type: 'com.example.kitchenSink#arrayLength',
        array: [1, 2, 3, 4, 5],
      }),
    ).toThrow('Record/array must not have more than 4 elements')
  })

  it('Applies boolean const constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#boolConst', {
      $type: 'com.example.kitchenSink#boolConst',
      boolean: false,
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#boolConst', {
        $type: 'com.example.kitchenSink#boolConst',
        boolean: true,
      }),
    ).toThrow('Record/boolean must be false')
  })

  it('Applies number range constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#numberRange', {
      $type: 'com.example.kitchenSink#numberRange',
      number: 2.5,
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#numberRange', {
        $type: 'com.example.kitchenSink#numberRange',
        number: 1,
      }),
    ).toThrow('Record/number can not be less than 2')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#numberRange', {
        $type: 'com.example.kitchenSink#numberRange',
        number: 5,
      }),
    ).toThrow('Record/number can not be greater than 4')
  })

  it('Applies number enum constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#numberEnum', {
      $type: 'com.example.kitchenSink#numberEnum',
      number: 1.5,
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#numberEnum', {
        $type: 'com.example.kitchenSink#numberEnum',
        number: 0,
      }),
    ).toThrow('Record/number must be one of (1|1.5|2)')
  })

  it('Applies number const constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#numberConst', {
      $type: 'com.example.kitchenSink#numberConst',
      number: 0,
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#numberConst', {
        $type: 'com.example.kitchenSink#numberConst',
        number: 1,
      }),
    ).toThrow('Record/number must be 0')
  })

  it('Applies integer range constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#integerRange', {
      $type: 'com.example.kitchenSink#integerRange',
      integer: 2,
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#integerRange', {
        $type: 'com.example.kitchenSink#integerRange',
        integer: 1,
      }),
    ).toThrow('Record/integer can not be less than 2')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#integerRange', {
        $type: 'com.example.kitchenSink#integerRange',
        integer: 5,
      }),
    ).toThrow('Record/integer can not be greater than 4')
  })

  it('Applies integer enum constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#integerEnum', {
      $type: 'com.example.kitchenSink#integerEnum',
      integer: 2,
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#integerEnum', {
        $type: 'com.example.kitchenSink#integerEnum',
        integer: 0,
      }),
    ).toThrow('Record/integer must be one of (1|2)')
  })

  it('Applies integer const constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#integerConst', {
      $type: 'com.example.kitchenSink#integerConst',
      integer: 0,
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#integerConst', {
        $type: 'com.example.kitchenSink#integerConst',
        integer: 1,
      }),
    ).toThrow('Record/integer must be 0')
  })

  it('Applies integer whole-number constraint', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#integerRange', {
        $type: 'com.example.kitchenSink#integerRange',
        integer: 2.5,
      }),
    ).toThrow('Record/integer must be an integer')
  })

  it('Applies string length constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#stringLength', {
      $type: 'com.example.kitchenSink#stringLength',
      string: '123',
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#stringLength', {
        $type: 'com.example.kitchenSink#stringLength',
        string: '1',
      }),
    ).toThrow('Record/string must not be shorter than 2 characters')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#stringLength', {
        $type: 'com.example.kitchenSink#stringLength',
        string: '12345',
      }),
    ).toThrow('Record/string must not be longer than 4 characters')
  })

  it('Applies string enum constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#stringEnum', {
      $type: 'com.example.kitchenSink#stringEnum',
      string: 'a',
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#stringEnum', {
        $type: 'com.example.kitchenSink#stringEnum',
        string: 'c',
      }),
    ).toThrow('Record/string must be one of (a|b)')
  })

  it('Applies string const constraint', () => {
    lex.assertValidRecord('com.example.kitchenSink#stringConst', {
      $type: 'com.example.kitchenSink#stringConst',
      string: 'a',
    })
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#stringConst', {
        $type: 'com.example.kitchenSink#stringConst',
        string: 'b',
      }),
    ).toThrow('Record/string must be a')
  })

  it('Applies datetime formatting constraint', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink#record', {
        $type: 'com.example.kitchenSink#record',
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
  const lex = new Lexicons()
  lex.add(KitchenSink)

  it('Passes valid parameters', () => {
    lex.assertValidXrpcParams('com.example.kitchenSink#query', {
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
    lex.assertValidXrpcParams('com.example.kitchenSink#procedure', {
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
  })

  it('Treats all parameters as optional', () => {
    lex.assertValidXrpcParams('com.example.kitchenSink#query', {})
    lex.assertValidXrpcParams('com.example.kitchenSink#procedure', {})
  })

  it('Validates parameter types', () => {
    expect(() =>
      lex.assertValidXrpcParams('com.example.kitchenSink#query', {
        boolean: 'string',
      }),
    ).toThrow('boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcParams('com.example.kitchenSink#procedure', {
        number: true,
      }),
    ).toThrow('number must be a number')
  })
})

describe('XRPC input validation', () => {
  const lex = new Lexicons()
  lex.add(KitchenSink)

  it('Passes valid inputs', () => {
    lex.assertValidXrpcInput('com.example.kitchenSink#procedure', {
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
      lex.assertValidXrpcInput('com.example.kitchenSink#procedure', {
        object: { boolean: 'string' },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('Input/object/boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcInput('com.example.kitchenSink#procedure', {}),
    ).toThrow('Input must have the property "object"')
  })
})

describe('XRPC output validation', () => {
  const lex = new Lexicons()
  lex.add(KitchenSink)

  it('Passes valid outputs', () => {
    lex.assertValidXrpcOutput('com.example.kitchenSink#query', {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      number: 123.45,
      integer: 123,
      string: 'string',
    })
    lex.assertValidXrpcOutput('com.example.kitchenSink#procedure', {
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
      lex.assertValidXrpcOutput('com.example.kitchenSink#query', {
        object: { boolean: 'string' },
        array: ['one', 'two'],
        boolean: true,
        number: 123.45,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('Output/object/boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcOutput('com.example.kitchenSink#procedure', {}),
    ).toThrow('Output must have the property "object"')
  })
})

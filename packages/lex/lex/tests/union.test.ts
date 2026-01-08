import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('union', () => {
  it('Handles unions correctly', () => {
    com.example.union.$parse({
      $type: 'com.example.union',
      unionOpen: {
        $type: 'com.example.kitchenSink#object',
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
      },
      unionClosed: {
        $type: 'com.example.kitchenSink#subobject',
        boolean: true,
      },
    })
    com.example.union.$parse({
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
      com.example.union.$parse({
        $type: 'com.example.union',
        unionOpen: {},
        unionClosed: {},
      }),
    ).toThrow(
      'Expected an object or record which includes a "$type" property value type at $.unionOpen (got object)',
    )
    expect(() =>
      com.example.union.$parse({
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
      'Expected one of "com.example.kitchenSink#object" or "com.example.kitchenSink#subobject" at $.unionClosed.$type (got "com.example.other")',
    )
  })
})

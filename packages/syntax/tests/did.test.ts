import { ensureValidDid, ensureValidDidRegex, InvalidDidError } from '../src'
import * as readline from 'readline'
import * as fs from 'fs'

describe('DID permissive validation', () => {
  const expectValid = (h: string) => {
    ensureValidDid(h)
    ensureValidDidRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => ensureValidDid(h)).toThrow(InvalidDidError)
    expect(() => ensureValidDidRegex(h)).toThrow(InvalidDidError)
  }

  it('enforces spec details', () => {
    expectValid('did:method:val')
    expectValid('did:method:VAL')
    expectValid('did:method:val123')
    expectValid('did:method:123')
    expectValid('did:method:val-two')
    expectValid('did:method:val_two')
    expectValid('did:method:val.two')
    expectValid('did:method:val:two')
    expectValid('did:method:val%BB')

    expectInvalid('did')
    expectInvalid('didmethodval')
    expectInvalid('method:did:val')
    expectInvalid('did:method:')
    expectInvalid('didmethod:val')
    expectInvalid('did:methodval')
    expectInvalid(':did:method:val')
    expectInvalid('did.method.val')
    expectInvalid('did:method:val:')
    expectInvalid('did:method:val%')
    expectInvalid('DID:method:val')
    expectInvalid('did:METHOD:val')
    expectInvalid('did:m123:val')

    expectValid('did:method:' + 'v'.repeat(240))
    expectInvalid('did:method:' + 'v'.repeat(8500))

    expectValid('did:m:v')
    expectValid('did:method::::val')
    expectValid('did:method:-')
    expectValid('did:method:-:_:.:%ab')
    expectValid('did:method:.')
    expectValid('did:method:_')
    expectValid('did:method::.')

    expectInvalid('did:method:val/two')
    expectInvalid('did:method:val?two')
    expectInvalid('did:method:val#two')
    expectInvalid('did:method:val%')

    expectValid(
      'did:onion:2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid',
    )
  })

  it('allows some real DID values', () => {
    expectValid('did:example:123456789abcdefghi')
    expectValid('did:plc:7iza6de2dwap2sbkpav7c6c6')
    expectValid('did:web:example.com')
    expectValid('did:web:localhost%3A1234')
    expectValid('did:key:zQ3shZc2QzApp2oymGvQbzP8eKheVshBHbU4ZYjeXqwSKEn6N')
    expectValid('did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a')
  })

  it('conforms to interop valid DIDs', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/did_syntax_valid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length === 0) {
        return
      }
      expectValid(line)
    })
  })

  it('conforms to interop invalid DIDs', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/did_syntax_invalid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length === 0) {
        return
      }
      expectInvalid(line)
    })
  })
})

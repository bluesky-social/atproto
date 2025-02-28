import * as fs from 'node:fs'
import * as readline from 'node:readline'
import { InvalidRecordKeyError, ensureValidRecordKey } from '../src'

describe('recordkey validation', () => {
  const expectValid = (r: string) => {
    ensureValidRecordKey(r)
  }
  const expectInvalid = (r: string) => {
    expect(() => ensureValidRecordKey(r)).toThrow(InvalidRecordKeyError)
  }

  it('conforms to interop valid recordkey', () => {
    // NOTE: these test vector files are maintained in: https://github.com/bluesky-social/atproto-interop-tests
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/recordkey_syntax_valid.txt`,
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

  it('conforms to interop invalid recordkeys', () => {
    // NOTE: these test vector files are maintained in: https://github.com/bluesky-social/atproto-interop-tests
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/recordkey_syntax_invalid.txt`,
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

import { ensureValidTid, InvalidTidError } from '../src'
import * as readline from 'readline'
import * as fs from 'fs'

describe('tid validation', () => {
  const expectValid = (t: string) => {
    ensureValidTid(t)
  }
  const expectInvalid = (t: string) => {
    expect(() => ensureValidTid(t)).toThrow(InvalidTidError)
  }

  it('conforms to interop valid tid', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/tid_syntax_valid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length == 0) {
        return
      }
      expectValid(line)
    })
  })

  it('conforms to interop invalid tids', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/tid_syntax_invalid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length == 0) {
        return
      }
      expectInvalid(line)
    })
  })
})

import { LexValue, fromBase64, parseCid } from '@atproto/lex-data'
import { parseTypedBlobRef } from './blob.js'

const CHAR_TAB = 0x09
const CHAR_NEWLINE = 0x0a
const CHAR_CARRIAGE_RETURN = 0x0d
const CHAR_SPACE = 0x20
const CHAR_DOUBLE_QUOTE = 0x22
const CHAR_PLUS = 0x2b
const CHAR_COMMA = 0x2c
const CHAR_MINUS = 0x2d
const CHAR_PERIOD = 0x2e
const CHAR_SLASH = 0x2f
const CHAR_DIGIT_0 = 0x30
const CHAR_DIGIT_1 = 0x31
const CHAR_DIGIT_9 = 0x39
const CHAR_COLON = 0x3a
const CHAR_EQUAL = 0x3d
const CHAR_UPPER_A = 0x41
const CHAR_UPPER_E = 0x45
const CHAR_UPPER_F = 0x46
const CHAR_UPPER_Z = 0x5a
const CHAR_LEFT_BRACKET = 0x5b
const CHAR_BACKSLASH = 0x5c
const CHAR_RIGHT_BRACKET = 0x5d
const CHAR_UNDERSCORE = 0x5f
const CHAR_DOLLAR = 0x24
const CHAR_LOWER_A = 0x61
const CHAR_LOWER_B = 0x62
const CHAR_LOWER_E = 0x65
const CHAR_LOWER_F = 0x66
const CHAR_LOWER_L = 0x6c
const CHAR_LOWER_N = 0x6e
const CHAR_LOWER_R = 0x72
const CHAR_LOWER_S = 0x73
const CHAR_LOWER_T = 0x74
const CHAR_LOWER_U = 0x75
const CHAR_LOWER_Z = 0x7a
const CHAR_LEFT_BRACE = 0x7b
const CHAR_RIGHT_BRACE = 0x7d

const DECODER = new TextDecoder('utf-8', { fatal: true })

const BASE64_LOOKUP = new Int8Array(256)
BASE64_LOOKUP.fill(-1)
for (let i = CHAR_UPPER_A; i <= CHAR_UPPER_Z; i++)
  BASE64_LOOKUP[i] = i - CHAR_UPPER_A
for (let i = CHAR_LOWER_A; i <= CHAR_LOWER_Z; i++)
  BASE64_LOOKUP[i] = i - CHAR_LOWER_A + 26
for (let i = CHAR_DIGIT_0; i <= CHAR_DIGIT_9; i++)
  BASE64_LOOKUP[i] = i - CHAR_DIGIT_0 + 52
BASE64_LOOKUP[CHAR_PLUS] = 62
BASE64_LOOKUP[CHAR_MINUS] = 62
BASE64_LOOKUP[CHAR_SLASH] = 63
BASE64_LOOKUP[CHAR_UNDERSCORE] = 63

const HEX_LOOKUP = new Int8Array(256)
HEX_LOOKUP.fill(-1)
for (let i = CHAR_DIGIT_0; i <= CHAR_DIGIT_9; i++)
  HEX_LOOKUP[i] = i - CHAR_DIGIT_0
for (let i = CHAR_UPPER_A; i <= CHAR_UPPER_F; i++)
  HEX_LOOKUP[i] = i - CHAR_UPPER_A + 10
for (let i = CHAR_LOWER_A; i <= CHAR_LOWER_F; i++)
  HEX_LOOKUP[i] = i - CHAR_LOWER_A + 10

// Thresholds for optimization heuristics
export const BASE64_NATIVE_THRESHOLD = 256 // Use native decoding for base64 strings > this length

export class JsonBytesDecoder {
  private pos = 0

  constructor(
    private readonly data: Uint8Array,
    private readonly strict = true,
  ) {}

  decode(): LexValue {
    this.skipWhitespace()
    const value = this.parseValue()
    this.skipWhitespace()

    if (this.pos < this.data.length) {
      throw new SyntaxError(
        `Unexpected data after JSON at position ${this.pos}`,
      )
    }

    return value
  }

  private parseValue(): LexValue {
    const ch = this.data[this.pos]

    // Optimize by checking most common value types first
    // Strings and objects are very common in real JSON
    if (ch === CHAR_DOUBLE_QUOTE) {
      return this.parseString()
    } else if (ch === CHAR_LEFT_BRACE) {
      return this.parseObject()
    } else if (ch === CHAR_LEFT_BRACKET) {
      return this.parseArray()
    } else if (ch === CHAR_LOWER_T) {
      return this.parseTrue()
    } else if (ch === CHAR_LOWER_F) {
      return this.parseFalse()
    } else if (ch === CHAR_LOWER_N) {
      return this.parseNull()
    } else {
      // Fallback for unexpected input
      return this.parseNumber()
    }
  }

  private parseObject(): LexValue {
    this.pos++ // skip '{'
    this.skipWhitespace()

    // Check for empty object
    if (this.data[this.pos] === CHAR_RIGHT_BRACE) {
      this.pos++
      return {}
    }

    let obj: Record<string, LexValue>
    let hasDollarKey = false // Track if we've seen any $ key for validation

    for (let i = 0; ; i++) {
      this.skipWhitespace()

      // Parse key
      if (this.data[this.pos] !== CHAR_DOUBLE_QUOTE) {
        throw new SyntaxError(`Expected string key at position ${this.pos}`)
      }

      // Track special keys for later validation
      if (this.data[this.pos + 1] === CHAR_DOLLAR) {
        hasDollarKey = true
      }

      const key = this.parseString()

      // Prevent prototype pollution
      if (key === '__proto__') {
        throw new SyntaxError('JSON object keys cannot be "__proto__"')
      }

      this.skipWhitespace()

      // Parse colon
      if (this.data[this.pos] !== CHAR_COLON) {
        throw new SyntaxError(`Expected ':' at position ${this.pos}`)
      }
      this.pos++
      this.skipWhitespace()

      // Parse $bytes or $link if it's the first and only key
      if (i === 0) {
        if (key === '$bytes' && this.data[this.pos] === CHAR_DOUBLE_QUOTE) {
          const initialPos = this.pos
          const b64Start = initialPos + 1
          const b64End = this.data.indexOf(CHAR_DOUBLE_QUOTE, b64Start)
          if (b64End !== -1) {
            this.pos = b64End + 1
            this.skipWhitespace()
            if (this.data[this.pos] === CHAR_RIGHT_BRACE) {
              this.pos++

              const base64Len = b64End - b64Start

              try {
                // Use native decoding for large base64 strings (much faster
                // based on benchmarks)
                if (base64Len > BASE64_NATIVE_THRESHOLD) {
                  const b64Str = this.decodeUnescapedString(b64Start, b64End)
                  return fromBase64(b64Str) // Validate and convert to LexValue bytes
                }

                // Manual decoding for smaller strings (optimized path)
                // Skip padding characters
                let b64EndNoPadding = b64End
                while (
                  b64EndNoPadding > b64Start &&
                  this.data[b64EndNoPadding - 1] === CHAR_EQUAL
                ) {
                  b64EndNoPadding--
                }

                const base64LenNoPadding = b64EndNoPadding - b64Start
                const bytesLen = Math.floor((base64LenNoPadding * 3) / 4)
                const result = new Uint8Array(bytesLen)

                for (
                  let i = b64Start, j = 0;
                  i <= b64EndNoPadding - 4;
                  i += 4
                ) {
                  const chunk =
                    (this.base64Value(this.data[i]) << 18) |
                    (this.base64Value(this.data[i + 1]) << 12) |
                    (this.base64Value(this.data[i + 2]) << 6) |
                    this.base64Value(this.data[i + 3])

                  result[j++] = (chunk >> 16) & 0xff
                  result[j++] = (chunk >> 8) & 0xff
                  result[j++] = chunk & 0xff
                }

                // Handle remaining characters (if any)
                if (base64LenNoPadding % 4 === 2) {
                  const chunk =
                    (this.base64Value(this.data[b64EndNoPadding - 2]) << 18) |
                    (this.base64Value(this.data[b64EndNoPadding - 1]) << 12)
                  result[bytesLen - 1] = (chunk >> 16) & 0xff
                } else if (base64LenNoPadding % 4 === 3) {
                  const chunk =
                    (this.base64Value(this.data[b64EndNoPadding - 3]) << 18) |
                    (this.base64Value(this.data[b64EndNoPadding - 2]) << 12) |
                    (this.base64Value(this.data[b64EndNoPadding - 1]) << 6)
                  result[bytesLen - 2] = (chunk >> 16) & 0xff
                  result[bytesLen - 1] = (chunk >> 8) & 0xff
                }

                return result
              } catch (_err) {
                if (this.strict) throw new TypeError('Invalid $bytes object')
                // ignore and parse as regular object
              }
            }
          }

          this.pos = initialPos // reset position to parse string properly
        } else if (
          key === '$link' &&
          this.data[this.pos] === CHAR_DOUBLE_QUOTE
        ) {
          const initialPos = this.pos
          const cidStart = initialPos + 1
          const cidEnd = this.data.indexOf(CHAR_DOUBLE_QUOTE, cidStart)
          if (cidEnd !== -1) {
            this.pos = cidEnd + 1
            this.skipWhitespace()
            if (this.data[this.pos] === CHAR_RIGHT_BRACE) {
              this.pos++
              const cidStr = this.decodeUnescapedString(cidStart, cidEnd)
              try {
                return parseCid(cidStr)
              } catch (_err) {
                if (this.strict) throw new TypeError('Invalid $link object')
                // ignore
              }
            }
          }

          this.pos = initialPos // reset position to parse string properly
        }
      }

      // Parse value
      obj ??= {}
      obj[key] = this.parseValue()

      this.skipWhitespace()

      const next = this.data[this.pos]
      if (next === CHAR_RIGHT_BRACE) {
        this.pos++
        break
      } else if (next === CHAR_COMMA) {
        this.pos++
      } else {
        throw new SyntaxError(`Expected ',' or '}' at position ${this.pos}`)
      }
    }

    // In strict mode, validate special objects with extra keys
    // Only check if we've seen a $ key (optimization)
    if (hasDollarKey && this.strict) {
      if (obj.$bytes !== undefined) {
        throw new TypeError('Invalid $bytes object')
      } else if (obj.$link !== undefined) {
        throw new TypeError('Invalid $link object')
      } else if (obj.$type === 'blob') {
        const blob = parseTypedBlobRef(obj, { strict: this.strict })
        if (blob) return blob
        throw new TypeError(`Invalid blob object`)
      } else if (obj.$type !== undefined) {
        if (typeof obj.$type !== 'string') {
          throw new TypeError(
            `Invalid $type property (${typeof obj.$type})`,
          )
        } else if (obj.$type.length === 0) {
          throw new TypeError(`Empty $type property`)
        }
      }
    }

    return obj
  }

  private parseArray(): LexValue[] {
    this.pos++ // skip '['
    this.skipWhitespace()

    const arr: LexValue[] = []

    // Check for empty array
    if (this.data[this.pos] === CHAR_RIGHT_BRACKET) {
      this.pos++
      return arr
    }

    for (;;) {
      this.skipWhitespace()
      arr.push(this.parseValue())
      this.skipWhitespace()

      const next = this.data[this.pos]
      if (next === CHAR_RIGHT_BRACKET) {
        this.pos++
        break
      } else if (next === CHAR_COMMA) {
        this.pos++
      } else {
        throw new SyntaxError(`Expected ',' or ']' at position ${this.pos}`)
      }
    }

    return arr
  }

  private parseString(): string {
    this.pos++ // skip opening quote
    const start = this.pos

    // Fast path: scan for quote, checking for escapes and control chars inline
    // Optimized for the common case of strings without escapes
    let i = this.pos
    while (i < this.data.length) {
      const ch = this.data[i]

      if (ch === CHAR_DOUBLE_QUOTE) {
        // Found end quote - fast path success
        this.pos = i + 1
        return this.decodeUnescapedString(start, i)
      } else if (ch === CHAR_BACKSLASH) {
        // Found escape or control character - need slow path
        break
      } else if (ch < 0x20) {
        throw new SyntaxError(`Unescaped control character at position ${i}`)
      }
      i++
    }

    // Slow path: handle escapes or control characters
    if (i >= this.data.length) {
      throw new SyntaxError('Unterminated string')
    }

    // We hit a backslash - need to process escape sequences
    let result = ''
    let segmentStart = start

    this.pos = i
    while (this.pos < this.data.length) {
      const ch = this.data[this.pos]

      if (ch === CHAR_DOUBLE_QUOTE) {
        // Found end of string
        if (segmentStart < this.pos) {
          result += this.decodeUnescapedString(segmentStart, this.pos)
        }
        this.pos++
        return result
      } else if (ch === CHAR_BACKSLASH) {
        // Process escape sequence
        if (segmentStart < this.pos) {
          result += this.decodeUnescapedString(segmentStart, this.pos)
        }
        this.pos++ // skip backslash
        result += this.parseEscapeSequence()
        segmentStart = this.pos
      } else if (ch < 0x20) {
        throw new SyntaxError(
          `Unescaped control character at position ${this.pos}`,
        )
      } else {
        this.pos++
      }
    }

    throw new SyntaxError('Unterminated string')
  }

  private parseEscapeSequence(): string {
    const ch = this.data[this.pos++]

    switch (ch) {
      case CHAR_DOUBLE_QUOTE:
        return '"'
      case CHAR_BACKSLASH:
        return '\\'
      case CHAR_SLASH:
        return '/'
      case CHAR_LOWER_B:
        return '\b'
      case CHAR_LOWER_F:
        return '\f'
      case CHAR_LOWER_N:
        return '\n'
      case CHAR_LOWER_R:
        return '\r'
      case CHAR_LOWER_T:
        return '\t'
      case CHAR_LOWER_U:
        return this.parseUnicodeEscape()
      default:
        throw new SyntaxError(`Invalid escape sequence at position ${this.pos}`)
    }
  }

  private parseUnicodeEscape(): string {
    // Parse \uXXXX
    let codePoint = 0
    for (let i = 0; i < 4; i++) {
      const ch = this.data[this.pos++]
      const hex = this.hexValue(ch)
      codePoint = (codePoint << 4) | hex
    }

    // Handle surrogate pairs
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      // High surrogate, check if followed by low surrogate
      if (
        this.pos + 5 < this.data.length &&
        this.data[this.pos] === CHAR_BACKSLASH &&
        this.data[this.pos + 1] === CHAR_LOWER_U
      ) {
        // Save position in case we need to backtrack
        const savedPos = this.pos
        this.pos += 2
        let low = 0
        for (let i = 0; i < 4; i++) {
          const ch = this.data[this.pos++]
          const hex = this.hexValue(ch)
          low = (low << 4) | hex
        }
        // Check if it's a valid low surrogate
        if (low >= 0xdc00 && low <= 0xdfff) {
          // Valid pair - combine into single codepoint
          codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00)
        } else {
          // Not a low surrogate - backtrack so it gets processed separately
          this.pos = savedPos
        }
      }
    }

    return String.fromCodePoint(codePoint)
  }

  private hexValue(ch: number): number {
    const value = HEX_LOOKUP[ch]
    if (value !== -1) return value
    throw new SyntaxError(`Invalid unicode escape at position ${this.pos}`)
  }

  private base64Value(ch: number): number {
    const value = BASE64_LOOKUP[ch]
    if (value !== -1) return value
    throw new SyntaxError(
      `Invalid base64 character: ${String.fromCharCode(ch)} at position ${this.pos}`,
    )
  }

  private decodeUnescapedString(start: number, end: number): string {
    const len = end - start
    if (len === 0) return ''

    // Fast path for very short ASCII strings (common for object keys like "id", "name", etc.)
    // Heuristic: only worth it for strings <= 20 chars where String.fromCharCode is faster
    // This is a hot path for object keys
    if (len <= 20) {
      let result = ''
      for (let i = start; i < end; i++) {
        const byte = this.data[i]
        if (byte > 0x7f) {
          // Hit non-ASCII, fall back to TextDecoder for full UTF-8 decoding
          const subView = new Uint8Array(
            this.data.buffer,
            this.data.byteOffset + start,
            len,
          )
          return DECODER.decode(subView)
        }
        result += String.fromCharCode(byte)
      }
      return result
    }

    // For longer strings, use TextDecoder directly (it's highly optimized)
    const subView = new Uint8Array(
      this.data.buffer,
      this.data.byteOffset + start,
      len,
    )
    return DECODER.decode(subView)
  }

  private parseNumber(): number {
    const start = this.pos

    let sign = 1
    let int = 0
    let decimal = 0
    let expSign = 1
    let exp = 0

    // Parse sign
    if (this.data[this.pos] === CHAR_MINUS) {
      sign = -1
      this.pos++
    }

    // Parse integer part
    if (this.data[this.pos] === CHAR_DIGIT_0) {
      this.pos++
      // Leading zero must be followed by decimal, exponent, or end
    } else if (
      // Note: cannot start with "0"
      this.data[this.pos] >= CHAR_DIGIT_1 &&
      this.data[this.pos] <= CHAR_DIGIT_9
    ) {
      do {
        int = int * 10 + (this.data[this.pos] - CHAR_DIGIT_0)
        this.pos++
      } while (
        this.pos < this.data.length &&
        this.data[this.pos] >= CHAR_DIGIT_0 &&
        this.data[this.pos] <= CHAR_DIGIT_9
      )
    } else {
      throw new SyntaxError(`Unexpected character at position ${this.pos}`)
    }

    // Strict mode validation is deferred until after decimal/exponent parsing
    // so that we can include the complete number value in the error message.

    // Parse decimal part
    if (this.pos < this.data.length && this.data[this.pos] === CHAR_PERIOD) {
      this.pos++
      if (
        this.pos >= this.data.length ||
        this.data[this.pos] < CHAR_DIGIT_0 ||
        this.data[this.pos] > CHAR_DIGIT_9
      ) {
        throw new SyntaxError(`Invalid number at position ${start}`)
      }
      let decimalPlace = 0.1
      do {
        decimal += (this.data[this.pos] - CHAR_DIGIT_0) * decimalPlace
        decimalPlace *= 0.1
        this.pos++
      } while (
        this.pos < this.data.length &&
        this.data[this.pos] >= CHAR_DIGIT_0 &&
        this.data[this.pos] <= CHAR_DIGIT_9
      )
    }

    // Parse exponent part
    if (
      this.pos < this.data.length &&
      (this.data[this.pos] === CHAR_LOWER_E ||
        this.data[this.pos] === CHAR_UPPER_E)
    ) {
      this.pos++
      if (
        this.pos < this.data.length &&
        (this.data[this.pos] === CHAR_PLUS ||
          this.data[this.pos] === CHAR_MINUS)
      ) {
        expSign = this.data[this.pos] === CHAR_MINUS ? -1 : 1
        this.pos++ // skip + or -
      }
      if (
        this.pos >= this.data.length ||
        this.data[this.pos] < CHAR_DIGIT_0 ||
        this.data[this.pos] > CHAR_DIGIT_9
      ) {
        throw new SyntaxError(`Invalid number at position ${start}`)
      }
      do {
        exp = exp * 10 + (this.data[this.pos] - CHAR_DIGIT_0)
        this.pos++
      } while (
        this.pos < this.data.length &&
        this.data[this.pos] >= CHAR_DIGIT_0 &&
        this.data[this.pos] <= CHAR_DIGIT_9
      )
    }

    const num = sign * (int + decimal) * Math.pow(10, expSign * exp)

    if (this.strict && !Number.isSafeInteger(num)) {
      throw new TypeError(`Invalid non-integer number: ${num}`)
    }

    return num
  }

  private parseTrue(): boolean {
    if (
      this.pos + 4 <= this.data.length &&
      this.data[this.pos] === CHAR_LOWER_T &&
      this.data[this.pos + 1] === CHAR_LOWER_R &&
      this.data[this.pos + 2] === CHAR_LOWER_U &&
      this.data[this.pos + 3] === CHAR_LOWER_E
    ) {
      this.pos += 4
      return true
    }
    throw new SyntaxError(`Unexpected token at position ${this.pos}`)
  }

  private parseFalse(): boolean {
    if (
      this.pos + 5 <= this.data.length &&
      this.data[this.pos] === CHAR_LOWER_F &&
      this.data[this.pos + 1] === CHAR_LOWER_A &&
      this.data[this.pos + 2] === CHAR_LOWER_L &&
      this.data[this.pos + 3] === CHAR_LOWER_S &&
      this.data[this.pos + 4] === CHAR_LOWER_E
    ) {
      this.pos += 5
      return false
    }
    throw new SyntaxError(`Unexpected token at position ${this.pos}`)
  }

  private parseNull(): null {
    if (
      this.pos + 4 <= this.data.length &&
      this.data[this.pos] === CHAR_LOWER_N &&
      this.data[this.pos + 1] === CHAR_LOWER_U &&
      this.data[this.pos + 2] === CHAR_LOWER_L &&
      this.data[this.pos + 3] === CHAR_LOWER_L
    ) {
      this.pos += 4
      return null
    }
    throw new SyntaxError(`Unexpected token at position ${this.pos}`)
  }

  private skipWhitespace(): void {
    // Optimized: check most common case (space) first, and use <= for compact check
    while (this.pos < this.data.length) {
      const ch = this.data[this.pos]
      // Optimize for the most common case: space (0x20)
      if (ch === CHAR_SPACE) {
        this.pos++
      } else if (
        ch === CHAR_TAB ||
        ch === CHAR_NEWLINE ||
        ch === CHAR_CARRIAGE_RETURN
      ) {
        this.pos++
      } else {
        break
      }
    }
  }
}

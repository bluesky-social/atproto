/**
 * Javascript uses utf16-encoded strings while most environments and specs
 * have standardized around utf8 (including JSON).
 *
 * After some lengthy debated we decided that richtext facets need to use
 * utf8 indices. This means we need tools to convert indices between utf8
 * and utf16, and that's precisely what this library handles.
 */

import { graphemeLen } from '@atproto/common-web'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class UnicodeString {
  utf16: string
  utf8: Uint8Array
  private _graphemeLen?: number | undefined

  constructor(utf16: string) {
    this.utf16 = utf16
    this.utf8 = encoder.encode(utf16)
  }

  get length() {
    return this.utf8.byteLength
  }

  get graphemeLength() {
    if (!this._graphemeLen) {
      this._graphemeLen = graphemeLen(this.utf16)
    }
    return this._graphemeLen
  }

  slice(start?: number, end?: number): string {
    return decoder.decode(this.utf8.slice(start, end))
  }

  utf16IndexToUtf8Index(i: number) {
    return encoder.encode(this.utf16.slice(0, i)).byteLength
  }

  toString() {
    return this.utf16
  }
}

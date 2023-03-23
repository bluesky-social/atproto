/**
 * Javascript uses utf16-encoded strings while most environments and specs
 * have standardized around utf8 (including JSON).
 *
 * After some lengthy debated we decided that richtext facets need to use
 * utf8 indices. This means we need tools to convert indices between utf8
 * and utf16, and that's precisely what this library handles.
 */

// import { AppBskyRichtextFacet } from '../client'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

// type MatcherFn = (utf16: string) => Generator<AppBskyRichtextFacet.Main>

export class UnicodeString {
  utf16: string
  utf8: Uint8Array

  constructor(utf16: string) {
    this.utf16 = utf16
    this.utf8 = encoder.encode(utf16)
  }

  get length() {
    return this.utf8.byteLength
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

  // detectFacets(matcher: MatcherFn): AppBskyRichtextFacet.Main[] {
  //   const facets = Array.from(matcher(this.utf16))
  //   if (this.mode === 'utf8') {
  //   }
  //   return facets
  // }
}

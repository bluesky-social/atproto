/*
= Rich Text Manipulation

When we sanitize rich text, we have to update the entity indices as the
text is modified. This can be modeled as inserts() and deletes() of the
rich text string. The possible scenarios are outlined below, along with
their expected behaviors.

NOTE: Slices are start inclusive, end exclusive

== richTextInsert()

Target string:

   0 1 2 3 4 5 6 7 8 910   // string indices
   h e l l o   w o r l d   // string value
       ^-------^           // target slice {start: 2, end: 7}

Scenarios:

A: ^                       // insert "test" at 0
B:        ^                // insert "test" at 4
C:                 ^       // insert "test" at 8

A = before           -> move both by num added
B = inner            -> move end by num added
C = after            -> noop

Results:

A: 0 1 2 3 4 5 6 7 8 910   // string indices
   t e s t h e l l o   w   // string value
               ^-------^   // target slice {start: 6, end: 11}

B: 0 1 2 3 4 5 6 7 8 910   // string indices
   h e l l t e s t o   w   // string value
       ^---------------^   // target slice {start: 2, end: 11}

C: 0 1 2 3 4 5 6 7 8 910   // string indices
   h e l l o   w o t e s   // string value
       ^-------^           // target slice {start: 2, end: 7}

== richTextDelete()

Target string:

   0 1 2 3 4 5 6 7 8 910   // string indices
   h e l l o   w o r l d   // string value
       ^-------^           // target slice {start: 2, end: 7}

Scenarios:

A: ^---------------^       // remove slice {start: 0, end: 9}
B:               ^-----^   // remove slice {start: 7, end: 11}
C:         ^-----------^   // remove slice {start: 4, end: 11}
D:       ^-^               // remove slice {start: 3, end: 5}
E:   ^-----^               // remove slice {start: 1, end: 5}
F: ^-^                     // remove slice {start: 0, end: 2}

A = entirely outer   -> delete slice
B = entirely after   -> noop
C = partially after  -> move end to remove-start
D = entirely inner   -> move end by num removed
E = partially before -> move start to remove-start index, move end by num removed
F = entirely before  -> move both by num removed

Results:

A: 0 1 2 3 4 5 6 7 8 910   // string indices
   l d                     // string value
                           // target slice (deleted)

B: 0 1 2 3 4 5 6 7 8 910   // string indices
   h e l l o   w           // string value
       ^-------^           // target slice {start: 2, end: 7}

C: 0 1 2 3 4 5 6 7 8 910   // string indices
   h e l l                 // string value
       ^-^                 // target slice {start: 2, end: 4}

D: 0 1 2 3 4 5 6 7 8 910   // string indices
   h e l   w o r l d       // string value
       ^---^               // target slice {start: 2, end: 5}

E: 0 1 2 3 4 5 6 7 8 910   // string indices
   h   w o r l d           // string value
     ^-^                   // target slice {start: 1, end: 3}

F: 0 1 2 3 4 5 6 7 8 910   // string indices
   l l o   w o r l d       // string value
   ^-------^               // target slice {start: 0, end: 5}
 */

import { AtpAgent } from '../agent'
import { AppBskyFeedPost, AppBskyRichtextFacet } from '../client'
import { UnicodeString } from './unicode'
import { sanitizeRichText } from './sanitization'
import { detectFacets } from './detection'

export type Facet = AppBskyRichtextFacet.Main
export type FacetLink = AppBskyRichtextFacet.Link
export type FacetMention = AppBskyRichtextFacet.Mention
export type Entity = AppBskyFeedPost.Entity

export interface RichTextProps {
  text: string
  facets?: Facet[]
  /**
   * @deprecated Use facets instead
   */
  entities?: Entity[]
}

export interface RichTextOpts {
  cleanNewlines?: boolean
}

export class RichTextSegment {
  constructor(public text: string, public facet?: Facet) {}

  isLink() {
    return this.facet?.value.$type === 'app.bsky.richtext.facet#link'
  }

  isMention() {
    return this.facet?.value.$type === 'app.bsky.richtext.facet#mention'
  }
}

export class RichText {
  unicodeText: UnicodeString
  facets?: Facet[]

  constructor(props: RichTextProps, opts?: RichTextOpts) {
    this.unicodeText = new UnicodeString(props.text)
    this.facets = props.facets
    if (!this.facets?.length && props.entities?.length) {
      this.facets = entitiesToFacets(this.unicodeText, props.entities)
    }
    if (opts?.cleanNewlines) {
      sanitizeRichText(this, { cleanNewlines: true }).copyInto(this)
    }
  }

  get text() {
    return this.unicodeText.toString()
  }

  clone() {
    return new RichText({
      text: this.unicodeText.utf16,
      facets: cloneDeep(this.facets),
    })
  }

  copyInto(target: RichText) {
    target.unicodeText = this.unicodeText
    target.facets = cloneDeep(this.facets)
  }

  *segments(): Generator<RichTextSegment, void, void> {
    const facets = this.facets || []
    if (!facets.length) {
      yield new RichTextSegment(this.unicodeText.utf16)
      return
    }

    let textCursor = 0
    let facetCursor = 0
    do {
      const currFacet = facets[facetCursor]
      if (textCursor < currFacet.index.start) {
        yield new RichTextSegment(
          this.unicodeText.slice(textCursor, currFacet.index.start),
        )
      } else if (textCursor > currFacet.index.start) {
        facetCursor++
        continue
      }
      if (currFacet.index.start < currFacet.index.end) {
        const subtext = this.unicodeText.slice(
          currFacet.index.start,
          currFacet.index.end,
        )
        if (!subtext.trim()) {
          // dont empty string entities
          yield new RichTextSegment(subtext)
        } else {
          yield new RichTextSegment(subtext, currFacet)
        }
      }
      textCursor = currFacet.index.end
      facetCursor++
    } while (facetCursor < facets.length)
    if (textCursor < this.unicodeText.length) {
      yield new RichTextSegment(
        this.unicodeText.slice(textCursor, this.unicodeText.length),
      )
    }
  }

  insert(insertIndex: number, insertText: string) {
    this.unicodeText = new UnicodeString(
      this.unicodeText.slice(0, insertIndex) +
        insertText +
        this.unicodeText.slice(insertIndex),
    )

    if (!this.facets?.length) {
      return this
    }

    const numCharsAdded = insertText.length
    for (const ent of this.facets) {
      // see comment at top of file for labels of each scenario
      // scenario A (before)
      if (insertIndex <= ent.index.start) {
        // move both by num added
        ent.index.start += numCharsAdded
        ent.index.end += numCharsAdded
      }
      // scenario B (inner)
      else if (insertIndex >= ent.index.start && insertIndex < ent.index.end) {
        // move end by num added
        ent.index.end += numCharsAdded
      }
      // scenario C (after)
      // noop
    }
    return this
  }

  delete(removeStartIndex: number, removeEndIndex: number) {
    this.unicodeText = new UnicodeString(
      this.unicodeText.slice(0, removeStartIndex) +
        this.unicodeText.slice(removeEndIndex),
    )

    if (!this.facets?.length) {
      return this
    }

    const numCharsRemoved = removeEndIndex - removeStartIndex
    for (const ent of this.facets) {
      // see comment at top of file for labels of each scenario
      // scenario A (entirely outer)
      if (
        removeStartIndex <= ent.index.start &&
        removeEndIndex >= ent.index.end
      ) {
        // delete slice (will get removed in final pass)
        ent.index.start = 0
        ent.index.end = 0
      }
      // scenario B (entirely after)
      else if (removeStartIndex > ent.index.end) {
        // noop
      }
      // scenario C (partially after)
      else if (
        removeStartIndex > ent.index.start &&
        removeStartIndex <= ent.index.end &&
        removeEndIndex > ent.index.end
      ) {
        // move end to remove start
        ent.index.end = removeStartIndex
      }
      // scenario D (entirely inner)
      else if (
        removeStartIndex >= ent.index.start &&
        removeEndIndex <= ent.index.end
      ) {
        // move end by num removed
        ent.index.end -= numCharsRemoved
      }
      // scenario E (partially before)
      else if (
        removeStartIndex < ent.index.start &&
        removeEndIndex >= ent.index.start &&
        removeEndIndex <= ent.index.end
      ) {
        // move start to remove-start index, move end by num removed
        ent.index.start = removeStartIndex
        ent.index.end -= numCharsRemoved
      }
      // scenario F (entirely before)
      else if (removeEndIndex < ent.index.start) {
        // move both by num removed
        ent.index.start -= numCharsRemoved
        ent.index.end -= numCharsRemoved
      }
    }

    // filter out any facets that were made irrelevant
    this.facets = this.facets.filter((ent) => ent.index.start < ent.index.end)
    return this
  }

  /**
   * Overwrites the existing facets with auto-detected facets
   */
  async detectFacets(agent: AtpAgent) {
    this.facets = await detectFacets(agent, this.unicodeText)
  }
}

function entitiesToFacets(text: UnicodeString, entities: Entity[]): Facet[] {
  const facets: Facet[] = []
  for (const ent of entities) {
    if (ent.type === 'link') {
      facets.push({
        $type: 'app.bsky.richtext.facet',
        index: {
          start: text.utf16IndexToUtf8Index(ent.index.start),
          end: text.utf16IndexToUtf8Index(ent.index.end),
        },
        value: { $type: 'app.bsky.richtext.facet#link', uri: ent.value },
      })
    } else if (ent.type === 'mention') {
      facets.push({
        $type: 'app.bsky.richtext.facet',
        index: {
          start: text.utf16IndexToUtf8Index(ent.index.start),
          end: text.utf16IndexToUtf8Index(ent.index.end),
        },
        value: { $type: 'app.bsky.richtext.facet#mention', did: ent.value },
      })
    }
  }
  return facets
}

function cloneDeep<T>(v: T): T {
  if (typeof v === 'undefined') {
    return v
  }
  return JSON.parse(JSON.stringify(v))
}

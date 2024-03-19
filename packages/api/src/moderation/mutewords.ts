import { AppBskyActorDefs, AppBskyRichtextFacet } from '../client'

const REGEX = {
  LEADING_TRAILING_PUNCTUATION: /(?:^\p{P}+|\p{P}+$)/gu,
  ESCAPE: /[[\]{}()*+?.\\^$|\s]/g,
  SEPARATORS: /[/\-–—()[\]_]+/g,
  WORD_BOUNDARY: /[\s\n\t\r\f\v]+?/g,
}

/**
 * List of 2-letter lang codes for languages that either don't use spaces, or
 * don't use spaces in a way conducive to word-based filtering.
 *
 * For these, we use a simple `String.includes` to check for a match.
 */
const LANGUAGE_EXCEPTIONS = [
  'ja', // Japanese
  'zh', // Chinese
  'ko', // Korean
  'th', // Thai
  'vi', // Vietnamese
]

export function hasMutedWord({
  mutedWords,
  text,
  facets,
  outlineTags,
  languages,
}: {
  mutedWords: AppBskyActorDefs.MutedWord[]
  text: string
  facets?: AppBskyRichtextFacet.Main[]
  outlineTags?: string[]
  languages?: string[]
}) {
  const exception = LANGUAGE_EXCEPTIONS.includes(languages?.[0] || '')
  const tags = ([] as string[])
    .concat(outlineTags || [])
    .concat(
      facets
        ?.filter((facet) => {
          return facet.features.find((feature) =>
            AppBskyRichtextFacet.isTag(feature),
          )
        })
        .map((t) => t.features[0].tag as string) || [],
    )
    .map((t) => t.toLowerCase())

  for (const mute of mutedWords) {
    const mutedWord = mute.value.toLowerCase()
    const postText = text.toLowerCase()

    // `content` applies to tags as well
    if (tags.includes(mutedWord)) return true
    // rest of the checks are for `content` only
    if (!mute.targets.includes('content')) continue
    // single character or other exception, has to use includes
    if ((mutedWord.length === 1 || exception) && postText.includes(mutedWord))
      return true
    // too long
    if (mutedWord.length > postText.length) continue
    // exact match
    if (mutedWord === postText) return true
    // any muted phrase with space or punctuation
    if (/(?:\s|\p{P})+?/u.test(mutedWord) && postText.includes(mutedWord))
      return true

    // check individual character groups
    const words = postText.split(REGEX.WORD_BOUNDARY)
    for (const word of words) {
      if (word === mutedWord) return true

      // compare word without leading/trailing punctuation, but allow internal
      // punctuation (such as `s@ssy`)
      const wordTrimmedPunctuation = word.replace(
        REGEX.LEADING_TRAILING_PUNCTUATION,
        '',
      )

      if (mutedWord === wordTrimmedPunctuation) return true
      if (mutedWord.length > wordTrimmedPunctuation.length) continue

      if (/\p{P}+/u.test(wordTrimmedPunctuation)) {
        const spacedWord = wordTrimmedPunctuation.replace(/\p{P}+/gu, ' ')
        if (spacedWord === mutedWord) return true

        const contiguousWord = spacedWord.replace(/\s/gu, '')
        if (contiguousWord === mutedWord) return true

        const wordParts = wordTrimmedPunctuation.split(/\p{P}+/u)
        for (const wordPart of wordParts) {
          if (wordPart === mutedWord) return true
        }
      }
    }
  }

  return false
}

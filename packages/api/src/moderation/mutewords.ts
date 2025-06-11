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

export type MuteWordMatch = {
  word: AppBskyActorDefs.MutedWord
}

export function matchMuteWords({
  mutedWords,
  text,
  facets,
  outlineTags,
  languages,
  actor,
}: {
  mutedWords: AppBskyActorDefs.MutedWord[]
  text: string
  facets?: AppBskyRichtextFacet.Main[]
  outlineTags?: string[]
  languages?: string[]
  actor?: AppBskyActorDefs.ProfileView | AppBskyActorDefs.ProfileViewBasic
}): MuteWordMatch[] | undefined {
  const exception = LANGUAGE_EXCEPTIONS.includes(languages?.[0] || '')
  const tags = ([] as string[])
    .concat(outlineTags || [])
    .concat(
      (facets || []).flatMap((facet) =>
        facet.features.filter(AppBskyRichtextFacet.isTag).map((tag) => tag.tag),
      ),
    )
    .map((t) => t.toLowerCase())

  const matches: MuteWordMatch[] = []

  outer: for (const mute of mutedWords) {
    const mutedWord = mute.value.toLowerCase()
    const postText = text.toLowerCase()

    // expired, ignore
    if (mute.expiresAt && mute.expiresAt < new Date().toISOString()) continue

    if (
      mute.actorTarget === 'exclude-following' &&
      Boolean(actor?.viewer?.following)
    )
      continue

    // `content` applies to tags as well
    if (tags.includes(mutedWord)) {
      matches.push({ word: mute })
      continue
    }
    // rest of the checks are for `content` only
    if (!mute.targets.includes('content')) continue
    // single character or other exception, has to use includes
    if ((mutedWord.length === 1 || exception) && postText.includes(mutedWord)) {
      matches.push({ word: mute })
      continue
    }
    // too long
    if (mutedWord.length > postText.length) continue
    // exact match
    if (mutedWord === postText) {
      matches.push({ word: mute })
      continue
    }
    // any muted phrase with space or punctuation
    if (/(?:\s|\p{P})+?/u.test(mutedWord) && postText.includes(mutedWord)) {
      matches.push({ word: mute })
      continue
    }

    // check individual character groups
    const words = postText.split(REGEX.WORD_BOUNDARY)
    for (const word of words) {
      if (word === mutedWord) {
        matches.push({ word: mute })
        continue outer
      }

      // compare word without leading/trailing punctuation, but allow internal
      // punctuation (such as `s@ssy`)
      const wordTrimmedPunctuation = word.replace(
        REGEX.LEADING_TRAILING_PUNCTUATION,
        '',
      )

      if (mutedWord === wordTrimmedPunctuation) {
        matches.push({ word: mute })
        continue outer
      }
      if (mutedWord.length > wordTrimmedPunctuation.length) continue

      if (/\p{P}+/u.test(wordTrimmedPunctuation)) {
        const spacedWord = wordTrimmedPunctuation.replace(/\p{P}+/gu, ' ')
        if (spacedWord === mutedWord) {
          matches.push({ word: mute })
          continue outer
        }

        const contiguousWord = spacedWord.replace(/\s/gu, '')
        if (contiguousWord === mutedWord) {
          matches.push({ word: mute })
          continue outer
        }

        const wordParts = wordTrimmedPunctuation.split(/\p{P}+/u)
        for (const wordPart of wordParts) {
          if (wordPart === mutedWord) {
            matches.push({ word: mute })
            continue outer
          }
        }
      }
    }
  }

  return matches.length ? matches : undefined
}

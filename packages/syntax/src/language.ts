const BCP47_REGEXP =
  /^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?<extension>[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?<privateUseA>[xX](-[A-Za-z0-9]{1,8})+))?)|(?<privateUseB>[xX](-[A-Za-z0-9]{1,8})+))$/

/**
 * The primary language subtag must be a lowercase two- or three-letter code
 * (RFC 5646 §2.1.1 recommends lowercase; the atproto interop suite treats
 * uppercase primary subtags such as `JA`, and bare four-letter runs such as
 * `jaja`, as invalid).
 *
 * This is enforced only in the strict {@link parseLanguageString} path.
 * {@link isValidLanguage} intentionally stays permissive of these legacy forms
 * so that existing records are not retroactively invalidated.
 */
function hasStrictPrimarySubtag(groups: { language?: string }): boolean {
  const language = groups.language
  if (!language) return true // grandfathered / private-use only: nothing to check
  const primary = language.split('-')[0]
  return /^[a-z]{2,3}$/.test(primary)
}

export type LanguageTag = {
  grandfathered?: string
  language?: string
  extlang?: string
  script?: string
  region?: string
  variant?: string
  extension?: string
  privateUse?: string
}

function matchValidLanguage(input: string): RegExpMatchArray | null {
  const parsed = input.match(BCP47_REGEXP)
  if (!parsed?.groups) return null
  if (hasDuplicateVariantOrSingleton(input, parsed.groups)) return null
  return parsed
}

/**
 * Detect repeated variant subtags or repeated extension singleton
 * subtags within a well-formed BCP 47 langtag. The comparison is
 * case-insensitive.
 *
 * The regex alone cannot enforce this — JavaScript named captures keep
 * only the last occurrence of a repeated group — so this is run as a
 * post-match check on the original input string.
 *
 * Grandfathered and privateuse-only tags carry neither variants nor
 * extension singletons and short-circuit.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc5646.html#section-4.1 RFC 5646 §4.1 Choice of Language Tag}
 * @see {@link https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1.1 RFC 5646 §2.1.1 Case Considerations}
 */
function hasDuplicateVariantOrSingleton(
  input: string,
  groups: { grandfathered?: string; privateUseB?: string },
): boolean {
  if (groups.grandfathered || groups.privateUseB) return false

  const subtags = input.split('-')
  let i = 1 // language

  if (subtags[0].length === 2 || subtags[0].length === 3) {
    // extlang: 0–3 subtags of 3 letters
    let count = 0
    while (
      count < 3 &&
      i < subtags.length &&
      /^[A-Za-z]{3}$/.test(subtags[i])
    ) {
      i++
      count++
    }
  }

  // script
  if (i < subtags.length && /^[A-Za-z]{4}$/.test(subtags[i])) i++
  // region
  if (i < subtags.length && /^([A-Za-z]{2}|[0-9]{3})$/.test(subtags[i])) i++

  const seenVariants = new Set<string>()
  while (
    i < subtags.length &&
    /^([A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3})$/.test(subtags[i])
  ) {
    const key = subtags[i].toLowerCase()
    if (seenVariants.has(key)) return true
    seenVariants.add(key)
    i++
  }

  const seenSingletons = new Set<string>()
  while (i < subtags.length && /^[0-9A-WYZa-wyz]$/.test(subtags[i])) {
    const singleton = subtags[i].toLowerCase()
    if (seenSingletons.has(singleton)) return true
    seenSingletons.add(singleton)
    i++
    while (i < subtags.length && /^[A-Za-z0-9]{2,8}$/.test(subtags[i])) i++
  }

  return false
}

export function parseLanguageString(input: string): LanguageTag | null {
  const parsed = matchValidLanguage(input)
  if (!parsed?.groups) return null

  const { groups } = parsed
  if (!hasStrictPrimarySubtag(groups)) return null
  return {
    grandfathered: groups.grandfathered,
    language: groups.language,
    extlang: groups.extlang,
    script: groups.script,
    region: groups.region,
    variant: groups.variant,
    extension: groups.extension,
    privateUse: groups.privateUseA || groups.privateUseB,
  }
}

/**
 * Validates well-formed BCP 47 syntax.
 *
 * Only checks the ABNF grammar of RFC 5646 §2.1. Semantic constraints from
 * §4.1 (e.g. no repeated variant subtags) are NOT enforced — use
 * {@link parseLanguageString} for strict validation.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1}
 */
export function isValidLanguage(input: string): boolean {
  return BCP47_REGEXP.test(input)
}

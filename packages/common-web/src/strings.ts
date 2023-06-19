import Graphemer from 'graphemer'
import * as ui8 from 'uint8arrays'

// counts the number of bytes in a utf8 string
export const utf8Len = (str: string): number => {
  return new TextEncoder().encode(str).byteLength
}

// counts the number of graphemes (user-displayed characters) in a string
export const graphemeLen = (str: string): number => {
  const splitter = new Graphemer()
  return splitter.countGraphemes(str)
}

export const utf8ToB64Url = (utf8: string): string => {
  return ui8.toString(ui8.fromString(utf8, 'utf8'), 'base64url')
}

export const b64UrlToUtf8 = (b64: string): string => {
  return ui8.toString(ui8.fromString(b64, 'base64url'), 'utf8')
}

export const parseLanguage = (langTag: string): LanguageTag | null => {
  const parsed = langTag.match(bcp47Regexp)
  if (!parsed?.groups) return null
  const parts = parsed.groups
  return {
    grandfathered: parts.grandfathered,
    language: parts.language,
    extlang: parts.extlang,
    script: parts.script,
    region: parts.region,
    variant: parts.variant,
    extension: parts.extension,
    privateUse: parts.privateUseA || parts.privateUseB,
  }
}

export const validateLanguage = (langTag: string): boolean => {
  return bcp47Regexp.test(langTag)
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

// Validates well-formed BCP 47 syntax: https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1
const bcp47Regexp =
  /^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?<extension>[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?<privateUseA>x(-[A-Za-z0-9]{1,8})+))?)|(?<privateUseB>x(-[A-Za-z0-9]{1,8})+))$/

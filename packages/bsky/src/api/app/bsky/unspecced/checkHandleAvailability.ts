import { isEmailValid } from '@hapi/address'
import * as ident from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  QueryParams,
  Suggestion,
} from '../../../../lexicon/types/app/bsky/unspecced/checkHandleAvailability'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.checkHandleAvailability({
    handler: async ({ params }) => {
      const { birthDate, email, handle } = validateParams(params)

      const [did] = await ctx.hydrator.actor.getDids([handle], {
        lookupUnidirectional: true,
      })
      if (!did) {
        return {
          encoding: 'application/json',
          body: {
            handle,
            result: {
              $type:
                'app.bsky.unspecced.checkHandleAvailability#resultAvailable',
            },
          },
        }
      }

      const suggestions = await getSuggestions(ctx, handle, email, birthDate)

      return {
        encoding: 'application/json',
        body: {
          handle,
          result: {
            $type:
              'app.bsky.unspecced.checkHandleAvailability#resultUnavailable',
            suggestions,
          },
        },
      }
    },
  })
}

const validateParams = (params: QueryParams) => {
  const { email } = params
  if (email && !isEmailValid(email)) {
    throw new InvalidRequestError('Invalid email address.', 'InvalidEmail')
  }

  return {
    birthDate: params.birthDate,
    email,
    handle: ident.normalizeHandle(params.handle),
  }
}

/** Gets the target number of suggestions, ensuring uniqueness and availability. */
const getSuggestions = async (
  ctx: AppContext,
  tentativeHandle: string,
  email: string | undefined,
  birthDate: string | undefined,
): Promise<Suggestion[]> => {
  const [subdomain, ...rest] = tentativeHandle.split('.')
  const domain = rest.join('.')

  let suggestions: Suggestion[] = []

  const want = 5
  let attempt = 0

  const deterministic = await availableSuggestions(
    ctx,
    deterministicSuggestions(subdomain, email, birthDate),
    tentativeHandle,
    domain,
  )
  suggestions.push(...deterministic)

  while (suggestions.length < want && attempt < 3) {
    const random = await availableSuggestions(
      ctx,
      randomSuggestions(subdomain),
      tentativeHandle,
      domain,
    )
    suggestions.push(...random)

    suggestions = [...suggestions, ...random]
    attempt++
  }

  return suggestions.slice(0, want)
}

type IntermediateSuggestion = {
  subdomain: string
  method: string
}

const availableSuggestions = async (
  ctx: AppContext,
  suggestions: IntermediateSuggestion[],
  tentativeHandle: string,
  domain: string,
): Promise<Suggestion[]> => {
  const join = (subdomain: string, domain: string) => `${subdomain}.${domain}`

  const validSuggestions = suggestions
    .filter((s) => {
      // @TODO: from a magic number in the PDS code.
      if (s.subdomain.length < 3) return false

      // @TODO: from a magic number in the PDS code.
      if (s.subdomain.length > 18) return false

      const handle = join(s.subdomain, domain)
      // @TODO: from a magic number in the entryway code.
      if (handle.length > 30) return false

      // Only valid, and not the tentative one.
      return ident.isValidHandle(handle) && handle !== tentativeHandle
    })
    .map(
      (s): Suggestion => ({
        handle: join(s.subdomain, domain),
        method: s.method,
      }),
    )

  const dids = await ctx.hydrator.actor.getDids(
    validSuggestions.map((s) => s.handle),
    {
      lookupUnidirectional: true,
    },
  )
  return validSuggestions.filter((_, i) => !dids[i])
}

const deterministicSuggestions = (
  subdomain: string,
  email: string | undefined,
  birthDate: string | undefined,
): IntermediateSuggestion[] => {
  const localPart = email
    ?.split('@')[0]
    .toLowerCase()
    .replace('.', '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
  const year = getYear(birthDate)

  return [
    ...suggestAppendDigits('handle_yob', subdomain, year),
    ...suggestValue('email', localPart),
    ...suggestAppendDigits('email_yob', localPart, year),
  ]
}

const randomSuggestions = (subdomain: string): IntermediateSuggestion[] => [
  ...suggestHyphens('hyphen', subdomain),
  ...suggestAppendRandomDigits('random_digits', subdomain),
]

const avoidDigits = ['69']

const getYear = (d: string | undefined): string | undefined => {
  if (!d) return undefined

  const date = new Date(d)
  if (isNaN(date.getTime())) return undefined

  const year = date.getFullYear().toString().slice(-2)
  return avoidDigits.includes(year) ? undefined : year
}

const suggestValue = (
  method: string,
  s: string | undefined,
): IntermediateSuggestion[] => {
  if (!s) return []
  return [{ subdomain: `${s}`, method }]
}

const suggestAppendDigits = (
  method: string,
  s: string | undefined,
  d: string | undefined,
): IntermediateSuggestion[] => {
  if (!s || !d) return []

  // If s already ends in digits, add an hyphen before appending the number.
  const separator = /\d$/.test(s) ? '-' : ''
  return [{ subdomain: `${s}${separator}${d}`, method }]
}

const suggestAppendRandomDigits = (
  method: string,
  s: string,
): IntermediateSuggestion[] => {
  const ss: IntermediateSuggestion[] = []
  const want = 2
  let got = 0
  while (got < want) {
    const randomDigits = Math.floor(Math.random() * 100).toString()
    if (avoidDigits.includes(randomDigits)) continue
    ss.push(...suggestAppendDigits(method, s, randomDigits))
    got++
  }
  return ss
}

const suggestHyphens = (
  method: string,
  s: string,
): IntermediateSuggestion[] => {
  const ss: IntermediateSuggestion[] = []
  // 2 suggestions or less, if the string is too short.
  const want = Math.min(Math.floor(s.length / 2), 2)
  let got = 0

  while (got < want) {
    // Exclude first and last character to avoid leading/trailing hyphens.
    for (let i = 1; i < s.length; i++) {
      // Randomly skip some combinations.
      if (Math.random() > 0.5) continue

      // @TODO: Check for slurs in either part of the string.
      if (s[i] === '-') {
        // Skip problematic cases, but count them to avoid infinite loop.
        got++
        continue
      }
      ss.push({ subdomain: `${s.slice(0, i)}-${s.slice(i)}`, method })
      got++
    }
  }

  return ss
}

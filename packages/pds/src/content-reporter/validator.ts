import { dedupeStrs } from '@atproto/common'

export class UnacceptableWordValidator {
  private bannedWords: Set<string>
  private falsePositives: Set<string>

  constructor(bannedWords: string[], falsePositives: string[] = []) {
    this.bannedWords = new Set(bannedWords.map((word) => word.toLowerCase()))
    this.falsePositives = new Set(
      falsePositives.map((word) => word.toLowerCase()),
    )
  }

  private normalize(domain: string): string[] {
    const withoutSymbols = domain.replace(/[\W_]+/g, '') // Remove non-alphanumeric characters
    const lowercase = withoutSymbols.toLowerCase()

    // Replace common leetspeak characters
    const leetSpeakReplacements: { [key: string]: string[] } = {
      '0': ['o'],
      '8': ['b'],
      '3': ['e'],
      '4': ['a'],
      '6': ['g'],
      '1': ['i', 'l'],
      '5': ['s'],
      '7': ['t'],
    }

    return this.generatePermutations(lowercase, leetSpeakReplacements)
  }

  private generatePermutations(
    domain: string,
    leetSpeakReplacements: { [key: string]: string[] },
  ): string[] {
    const results: string[] = []

    const leetChars = Object.keys(leetSpeakReplacements)
    const firstLeetCharIndex = [...domain].findIndex((char) =>
      leetChars.includes(char),
    )

    if (firstLeetCharIndex === -1) {
      // No leetspeak characters left in the string
      results.push(domain)
    } else {
      const char = domain[firstLeetCharIndex]
      const beforeChar = domain.slice(0, firstLeetCharIndex)
      const afterChar = domain.slice(firstLeetCharIndex + 1)

      // For each replacement, generate all possible combinations
      for (const replacement of leetSpeakReplacements[char]) {
        const replaced = beforeChar + replacement + afterChar

        // Recursively generate all permutations for the rest of the string
        const otherPermutations = this.generatePermutations(
          replaced,
          leetSpeakReplacements,
        )

        // Add these permutations to the results
        results.push(...otherPermutations)
      }
    }

    return dedupeStrs(results)
  }

  public getMatches(domain: string): string[] {
    const normalizedDomains = this.normalize(domain)

    const foundUnacceptableWords: string[] = []

    for (const normalizedDomain of normalizedDomains) {
      for (const word of this.bannedWords) {
        const match = normalizedDomain.indexOf(word)
        if (match > -1) {
          let isFalsePositive = false
          for (const falsePositive of this.falsePositives) {
            const s_fp = falsePositive.indexOf(word)
            const s_nd = match - s_fp
            const wordToMatch = normalizedDomain.slice(
              s_nd,
              s_nd + falsePositive.length,
            )
            if (wordToMatch === falsePositive) {
              isFalsePositive = true
              break
            }
          }

          if (!isFalsePositive) {
            foundUnacceptableWords.push(word)
          }
        }
      }
    }

    if (foundUnacceptableWords.length > 0) {
      return foundUnacceptableWords
    }

    return []
  }
}

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../style.css'),
  'utf8',
)

/** Tokens that map a provider-injected --branding-color-* at runtime. */
const BRANDED_TOKENS = [
  ['primary', 'primary'],
  ['primary-foreground', 'primary-contrast'],
  ['destructive', 'error'],
  ['ring', 'primary'],
  ['info', 'info'],
  ['warning', 'warning'],
  ['success', 'success'],
] as const

/** Tokens derived from the branded ones. */
const DERIVED_TOKENS = [
  ['sidebar-primary', 'primary'],
  ['sidebar-primary-foreground', 'primary-foreground'],
  ['sidebar-ring', 'ring'],
] as const

const NEUTRAL_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'border',
  'input',
  'sidebar',
  'sidebar-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
] as const

const SHADCN_TOKENS = [
  ...NEUTRAL_TOKENS,
  ...BRANDED_TOKENS.map(([token]) => token),
  ...DERIVED_TOKENS.map(([token]) => token),
] as const

function blockFor(marker: string): string {
  const start = css.indexOf(marker)
  expect(start, `missing block: ${marker}`).toBeGreaterThan(-1)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n  }', open)
  const closeTop = css.indexOf('\n}', open)
  const end = close > -1 && close < closeTop ? close : closeTop
  return css.slice(open, end)
}

describe('style.css theme tokens', () => {
  const light = blockFor('/* shadcn tokens: light */')
  const dark = blockFor('/* shadcn tokens: dark */')
  const brandedLight = blockFor('/* runtime branding: light */')
  const brandedDark = blockFor('/* runtime branding: dark */')

  it.each(NEUTRAL_TOKENS)('declares --%s in the light scheme', (token) => {
    expect(light).toContain(`--${token}:`)
  })

  it.each(NEUTRAL_TOKENS)('declares --%s in the dark scheme', (token) => {
    expect(dark).toContain(`--${token}:`)
  })

  it.each(BRANDED_TOKENS)(
    '--%s maps --branding-color-%s with a static fallback, in both schemes',
    (token, branding) => {
      for (const block of [brandedLight, brandedDark]) {
        const pattern = new RegExp(
          `--${token}: rgb\\(\\s*var\\(--branding-color-${branding}, [\\d ]+\\)\\s*\\);`,
        )
        expect(block).toMatch(pattern)
      }
    },
  )

  it.each(DERIVED_TOKENS)('--%s derives from --%s', (token, source) => {
    expect(brandedLight).toContain(`--${token}: var(--${source});`)
  })

  it('exposes the tokens to tailwind via @theme inline', () => {
    for (const token of SHADCN_TOKENS) {
      expect(css).toContain(`--color-${token}: var(--${token});`)
    }
  })

  it('declares a radius scale', () => {
    expect(css).toContain('--radius:')
  })

  it('drives dark mode from prefers-color-scheme, not a .dark class', () => {
    expect(css).toContain(
      '@custom-variant dark (@media (prefers-color-scheme: dark));',
    )
  })
})

describe('auth screen background', () => {
  const light = blockFor('/* auth background: light */')
  const dark = blockFor('/* auth background: dark */')

  it('paints the light background image over the muted base', () => {
    expect(light).toContain('background-color: var(--muted);')
    expect(light).toMatch(
      /background-image: var\(--branding-background-light-image, none\);/,
    )
  })

  it('swaps to the dark background image in the dark scheme', () => {
    expect(dark).toMatch(
      /background-image: var\(--branding-background-dark-image, none\);/,
    )
  })

  it('picks the dark background via prefers-color-scheme', () => {
    const idx = css.indexOf('/* auth background: dark */')
    const media = css.lastIndexOf('@media (prefers-color-scheme: dark)', idx)
    expect(media).toBeGreaterThan(-1)
  })
})

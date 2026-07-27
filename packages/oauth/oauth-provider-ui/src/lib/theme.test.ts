import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../style.css'),
  'utf8',
)

const SHADCN_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const

// Legacy tokens that phases 1-3 still depend on. Removed in phase 4 only.
const LEGACY_TOKENS = [
  '--color-text-default',
  '--color-text-light',
  '--color-contrast-0',
  '--color-contrast-25',
  '--color-primary-500',
  '--color-error-500',
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

  it.each(SHADCN_TOKENS)('declares --%s in the light scheme', (token) => {
    expect(light).toContain(`--${token}:`)
  })

  it.each(SHADCN_TOKENS)('declares --%s in the dark scheme', (token) => {
    expect(dark).toContain(`--${token}:`)
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

  it.each(LEGACY_TOKENS)('still declares the legacy token %s', (token) => {
    expect(css).toContain(token)
  })
})

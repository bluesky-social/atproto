/**
 * The authorization flow deliberately does not use a router (view changes
 * must not create browser history entries). To still allow refreshing the
 * page without losing one's place in the flow, the current step is
 * reflected in the URL fragment (`#step=<slug>`) using
 * `history.replaceState`, and read back on page load.
 */

export const AUTH_STEPS = [
  'welcome',
  'sign-in',
  'sign-up',
  'reset-password',
  'reset-password-confirm',
  'consent',
] as const

export type AuthStep = (typeof AUTH_STEPS)[number]

const STEP_HASH_PREFIX = '#step='

export function isAuthStep(value: unknown): value is AuthStep {
  return (AUTH_STEPS as readonly unknown[]).includes(value)
}

export function parseStepHash(hash: string): AuthStep | undefined {
  if (!hash.startsWith(STEP_HASH_PREFIX)) return undefined
  const value = hash.slice(STEP_HASH_PREFIX.length)
  return isAuthStep(value) ? value : undefined
}

export function formatStepHash(step: AuthStep): string {
  return `${STEP_HASH_PREFIX}${step}`
}

export function readLocationStep(): AuthStep | undefined {
  return parseStepHash(window.location.hash)
}

export function syncLocationStep(step: AuthStep): void {
  const hash = formatStepHash(step)
  if (window.location.hash === hash) return
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search + hash,
  )
}

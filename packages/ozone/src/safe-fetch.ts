import { safeFetchWrap } from '@atproto-labs/fetch-node'

export const createSafeFetch = () => {
  const safeFetch = safeFetchWrap({
    allowImplicitRedirect: true,
    allowIpHost: false,
    responseMaxSize: Infinity,
    timeout: 30e3,
  })

  return (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
    safeFetch(input, { ...init, redirect: 'error' })
}

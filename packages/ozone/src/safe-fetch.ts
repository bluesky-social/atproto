import { safeFetchWrap } from '@atproto-labs/fetch-node'

export const createSafeFetch = (responseMaxSize: number) => {
  const safeFetch = safeFetchWrap({
    allowImplicitRedirect: true,
    allowIpHost: false,
    responseMaxSize,
    timeout: 30e3,
  })

  return (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
    safeFetch(input, { ...init, redirect: 'error' })
}

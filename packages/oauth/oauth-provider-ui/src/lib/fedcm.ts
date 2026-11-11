import type {
  Account,
  FedcmRegistrationData,
} from '@atproto/oauth-provider-api'

export type FedcmPushedAccount = {
  id: string
  name: string
  email: string
  picture?: string
}

export type FedcmSyncSession = {
  account: Account
  loginRequired: boolean
  ephemeralToken?: string
}

type FedcmNavigator = Navigator & {
  login?: {
    // @NOTE The two-argument form requires `#fedcm-lightweight-mode`; without
    // it the browser ignores the extra argument.
    setStatus?: (
      status: 'logged-in' | 'logged-out',
      options?: { accounts: FedcmPushedAccount[]; expiration?: number },
    ) => void | PromiseLike<void>
  }
}

type FedcmWindow = Window & {
  IdentityProvider?: {
    close?: () => void | PromiseLike<void>
    register?: (configUrl: string) => Promise<boolean>
  }
}

/** Remembered, active, non-ephemeral sessions, as FedCM accounts. */
export function toFedcmPushedAccounts(
  sessions: readonly FedcmSyncSession[],
): FedcmPushedAccount[] {
  return sessions
    .filter(
      (s) => !s.ephemeralToken && !s.account.deactivated && !s.loginRequired,
    )
    .map(({ account }) => {
      const handle = account.handle ? `@${account.handle}` : undefined
      return {
        id: account.did,
        name: account.name ?? handle ?? account.did,
        email: handle ?? account.did,
        ...(account.picture ? { picture: account.picture } : undefined),
      }
    })
}

/**
 * Push the device's accounts to the browser and register this origin as a FedCM
 * IdP. Best-effort: missing APIs are skipped, failures are warned about.
 */
export async function syncFedcmRegistration(
  data: FedcmRegistrationData,
  sessions: readonly FedcmSyncSession[],
): Promise<void> {
  const accounts = toFedcmPushedAccounts(sessions)

  try {
    const login =
      typeof navigator !== 'undefined'
        ? (navigator as FedcmNavigator).login
        : undefined
    if (accounts.length) {
      await login?.setStatus?.('logged-in', {
        accounts,
        expiration: data.accountsExpiration,
      })
    } else {
      await login?.setStatus?.('logged-out')
    }
  } catch (err) {
    console.warn('FedCM: failed to update login status', err)
  }

  if (!accounts.length) return

  try {
    const idp =
      typeof window !== 'undefined'
        ? (window as FedcmWindow).IdentityProvider
        : undefined
    await idp?.register?.(data.configUrl)
  } catch (err) {
    console.warn('FedCM: failed to register identity provider', err)
  }
}

/** Notify FedCM that sign-in finished and close its login window when supported. */
export async function completeFedcmLogin(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined') {
      await (navigator as FedcmNavigator).login?.setStatus?.('logged-in')
    }
  } catch {
    // @NOTE FedCM status updates are best-effort browser hints.
  }

  try {
    if (typeof window !== 'undefined') {
      await (window as FedcmWindow).IdentityProvider?.close?.()
    }
  } catch {
    // @NOTE Closing the FedCM window is best-effort across browser versions.
  }
}

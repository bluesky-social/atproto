type FedcmNavigator = Navigator & {
  login?: {
    setStatus?: (status: 'logged-in' | 'logged-out') => void | PromiseLike<void>
  }
}

type FedcmWindow = Window & {
  IdentityProvider?: {
    close?: () => void | PromiseLike<void>
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

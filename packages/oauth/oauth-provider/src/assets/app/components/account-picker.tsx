import type { HTMLAttributes, ReactNode } from 'react'
import { Account } from '../backend-data'
import { clsx } from '../lib/clsx'

export type AccountPickerProps = {
  accounts: readonly Account[]

  onAccount: (account: Account) => void
  accountAria?: (account: Account) => string

  onOther?: () => void
  otherLabel?: ReactNode
  otherAria?: string

  onBack?: () => void
  backLabel?: ReactNode
  backAria?: string
}

export function AccountPicker({
  accounts,

  onAccount,
  accountAria = (a) => `Sign in as ${a.name}`,

  onOther = undefined,
  otherLabel = 'Other account',
  otherAria = 'Login to account that is not listed',

  onBack,
  backAria,
  backLabel = backAria,

  className,
  ...attrs
}: AccountPickerProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...attrs} className={clsx('flex flex-col', className)}>
      <p className="font-medium p-4">Sign in as...</p>

      {accounts.map((account) => {
        const [name, identifier] = [
          account.name,
          account.preferred_username,
          account.email,
          account.sub,
        ].filter(Boolean) as [string, string?]

        return (
          <button
            key={account.sub}
            className="cursor-pointer text-start flex items-center justify-between py-2 px-6 border-t border-b -mb-px hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-900"
            onClick={() => onAccount(account)}
            role="button"
            aria-label={accountAria(account)}
          >
            <div className="pr-2 flex items-center justify-start max-w-full overflow-hidden">
              {account.picture && (
                <img
                  crossOrigin="anonymous"
                  src={account.picture}
                  alt={name}
                  className="w-8 h-8 mr-2 rounded-full"
                />
              )}
              <div className="min-w-0 my-2 flex-auto truncate">
                <span className="font-semibold">{name}</span>
                {identifier && (
                  <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                    {identifier}
                  </span>
                )}
              </div>
            </div>
            <span className="scale-x-50 font-semibold text-xl">&gt;</span>
          </button>
        )
      })}
      {onOther && (
        <button
          className="cursor-pointer text-start flex items-center justify-between py-2 px-6 border-t border-b hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-900"
          onClick={onOther}
          aria-label={otherAria}
          role="button"
        >
          <div className="min-w-0 my-2 flex-auto truncate">{otherLabel}</div>

          <span className="scale-x-50 font-semibold text-xl">&gt;</span>
        </button>
      )}

      <div className="flex-auto" />

      {onBack && (
        <div className="p-4 flex flex-wrap items-center justify-between">
          <button
            type="button"
            onClick={() => onBack()}
            className="py-2 bg-transparent text-primary rounded-md font-light"
            aria-label={backAria}
          >
            {backLabel}
          </button>
        </div>
      )}
    </div>
  )
}

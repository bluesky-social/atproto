import type { HTMLAttributes, ReactNode } from 'react'
import { Account } from '../types'
import { clsx } from '../lib/clsx'

export type AccountPickerProps = {
  accounts: readonly Account[]
  onAccount: (account: Account) => void

  onOther?: () => void
  otherLabel?: ReactNode

  onBack?: () => void
  backLabel?: ReactNode
}

export function AccountPicker({
  accounts,
  onAccount,
  onOther = undefined,
  otherLabel = 'Other account',
  onBack,
  backLabel,

  className,
  ...attrs
}: AccountPickerProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...attrs} className={clsx('flex flex-col', className)}>
      <p className="font-medium p-4">Sign in as...</p>
      <ul>
        {accounts.map((account) => {
          const [name, identifier] = [
            account.name,
            account.preferred_username,
            account.email,
            account.sub,
          ].filter(Boolean) as [string, string?]

          return (
            <li
              key={account.sub}
              className="cursor-pointer flex items-center justify-between p-4 -mb-px border-t border-b hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-900"
              onClick={() => onAccount(account)}
            >
              <div className="pr-2 flex items-center justify-start max-w-full overflow-hidden">
                {account.picture && (
                  <img
                    crossOrigin="anonymous"
                    src={account.picture}
                    alt={name}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="min-w-0 flex-auto truncate">
                  <span className="font-semibold">{name}</span>
                  {identifier && (
                    <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {identifier}
                    </span>
                  )}
                </span>
              </div>
              <span className="scale-x-75">&gt;</span>
            </li>
          )
        })}
        {onOther && (
          <li
            className="cursor-pointer flex items-center justify-between p-4 -mb-px border-t border-b hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-900"
            onClick={onOther}
          >
            <span className="min-w-0 flex-auto truncate">{otherLabel}</span>

            <span className="scale-x-75">&gt;</span>
          </li>
        )}
      </ul>

      <div className="flex-auto" />

      {onBack && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onBack()}
            className="bg-transparent font-light text-primary rounded-md py-2"
          >
            {backLabel}
          </button>
        </div>
      )}
    </div>
  )
}

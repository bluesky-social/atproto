import type { HTMLAttributes, ReactNode } from 'react'
import { Account } from '../backend-data'
import { clsx } from '../lib/clsx'
import { Button } from './button'

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

function CaretRight() {
  return (
    <span className="scale-x-50 font-semibold text-xl font-mono">&gt;</span>
  )
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
      <p className="font-medium mb-1 text-slate-600 dark:text-slate-400">
        Sign in as...
      </p>

      <div className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        {accounts.map((account, i, array) => {
          const [name, identifier] = [
            account.name,
            account.preferred_username,
            account.email,
            account.sub,
          ].filter(Boolean) as [string, string?]

          return (
            <button
              key={account.sub}
              className={clsx(
                'cursor-pointer flex items-center justify-between py-1 px-3',
                'hover:bg-slate-100 dark:hover:bg-slate-800',
                i < array.length - 1 || onOther != null
                  ? 'border-b border-slate-200 dark:border-slate-700'
                  : undefined,
              )}
              onClick={() => onAccount(account)}
              role="button"
              aria-label={accountAria(account)}
            >
              <div className="pr-2 flex items-center justify-start max-w-full overflow-hidden">
                {account.picture ? (
                  <img
                    crossOrigin="anonymous"
                    src={account.picture}
                    alt={name}
                    className="w-6 h-6 mr-2 rounded-full"
                  />
                ) : (
                  <svg
                    className="w-6 h-6 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="none"
                  >
                    <circle cx="12" cy="12" r="12" fill="#0070ff"></circle>
                    <circle cx="12" cy="9.5" r="3.5" fill="#fff"></circle>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="#fff"
                      d="M 12.058 22.784 C 9.422 22.784 7.007 21.836 5.137 20.262 C 5.667 17.988 8.534 16.25 11.99 16.25 C 15.494 16.25 18.391 18.036 18.864 20.357 C 17.01 21.874 14.64 22.784 12.058 22.784 Z"
                    ></path>
                  </svg>
                )}
                <div className="min-w-0 my-2 flex-auto text-start truncate">
                  <span className="font-semibold">{name}</span>
                  {identifier && (
                    <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {identifier}
                    </span>
                  )}
                </div>
              </div>
              <CaretRight />
            </button>
          )
        })}
        {onOther && (
          <button
            className="cursor-pointer flex items-center justify-between py-1 px-3 pl-10 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onOther}
            aria-label={otherAria}
            role="button"
          >
            <div className="min-w-0 my-2 flex-auto text-start truncate">
              {otherLabel}
            </div>
            <CaretRight />
          </button>
        )}
      </div>

      <div className="flex-auto" />

      {onBack && (
        <div className="mt-4 flex flex-wrap items-center justify-between">
          <Button onClick={() => onBack()} aria-label={backAria}>
            {backLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

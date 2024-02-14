import { Account } from '../types'
import { Layout } from './layout'

export function AccountList({
  accounts,
  onAccount,
  another = undefined,
  onBack = undefined,
  ...props
}: {
  accounts: readonly Account[]
  onAccount: (account: Account) => void
  another?: () => void
  onBack?: () => void
}) {
  return (
    <Layout title="Sign in as..." subTitle="Select from an existing account">
      <div className="max-w-lg w-full" {...props}>
        <p className="font-medium p-4">Sign in as...</p>
        <ul>
          {accounts.map((account) => (
            <li
              key={account.sub}
              className="cursor-pointer flex items-center justify-between p-4 -mb-px border-t border-b border-slate-200 dark:border-slate-700"
              onClick={() => onAccount(account)}
            >
              <div className="flex items-center justify-start">
                {account.picture && (
                  <img
                    crossOrigin="anonymous"
                    src={account.picture}
                    alt={account.name}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="min-w-0 flex-auto truncate">
                  <span className="ml-2 font-semibold">{account.name}</span>
                  <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                    {account.preferred_username}
                  </span>
                </span>
              </div>
              <span className="scale-x-75">&gt;</span>
            </li>
          ))}
          {another && (
            <li
              className="cursor-pointer flex items-center justify-between p-4 -mb-px border-t border-b border-slate-200 dark:border-slate-700"
              onClick={() => another()}
            >
              <span className="min-w-0 flex-auto truncate">Other account</span>

              <span className="scale-x-75">&gt;</span>
            </li>
          )}
        </ul>

        {onBack && (
          <div className="m-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onBack()}
              className="bg-transparent font-light text-blue-600 rounded-md py-2"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

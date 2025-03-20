import React from 'react'
import { Popover } from 'radix-ui'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
// import { XMarkIcon } from '@heroicons/react/24/solid'
import { clsx } from 'clsx'

const accounts = [
  {
    handle: '@esb.lol',
    did: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
    avatar:
      'https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg',
  },
  {
    handle: '@test.esb.lol',
    did: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
    avatar:
      'https://cdn.bsky.app/img/avatar/plain/did:plc:dpajgwmnecpdyjyqzjzm6bnb/bafkreia6dx7fhoi6fxwfpgm7jrxijpqci7ap53wpilkpazojwvqlmgud2m@jpeg',
  },
]

export function AccountSelector() {
  const { _ } = useLingui()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="w-12 h-12 rounded-full overflow-hidden"
          aria-label={_(msg`Select an account`)}
        >
          <img src="https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="PopoverContent px-4 md:px-6 w-full"
          sideOffset={5}
          style={{ width: 360 }}
        >
          <div className="relative bg-contrast-25 rounded-lg overflow-hidden">
            <div className="flex flex-col">
              {accounts.map((account, i) => (
                <button
                  key={account.did}
                  className={clsx([
                    'flex items-center space-x-3 p-3 pr-4',
                    'hover:bg-contrast-50',
                    i !== 0 && 'border-t border-contrast-50',
                  ])}
                >
                  <img
                    src={account.avatar}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="text-left truncate">
                    <p className="font-bold text-text-default">
                      {account.handle}
                    </p>
                    <p className="text-sm text-text-light truncate">
                      {account.did}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/*
            <Popover.Close
              className="PopoverClose w-5 h-5 absolute top-2 right-2 text-text-light"
              aria-label="Close"
            >
              <XMarkIcon />
            </Popover.Close>
            */}
          </div>

          <Popover.Arrow className="PopoverArrow text-contrast-25" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

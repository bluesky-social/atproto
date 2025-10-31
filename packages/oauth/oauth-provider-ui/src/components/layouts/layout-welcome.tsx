import { useLingui } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX, ReactNode } from 'react'
import type { CustomizationData } from '@atproto/oauth-provider-api'
import { Override } from '../../lib/util.ts'
import { PageFooter } from '../utils/page-footer.tsx'

export type LayoutWelcomeProps = Override<
  JSX.IntrinsicElements['div'],
  {
    customizationData?: CustomizationData
    title?: ReactNode
    htmlTitle?: string
  }
>

export function LayoutWelcome({
  customizationData: { logo, name, links } = {},
  title,
  htmlTitle = typeof title === 'string' ? title : name,

  // div
  className,
  children,
  ...props
}: LayoutWelcomeProps) {
  const { t } = useLingui()

  return (
    <div
      {...props}
      className={clsx(
        'min-h-screen w-full',
        'flex flex-col items-center justify-center',
        className,
      )}
    >
      {htmlTitle && <title>{htmlTitle}</title>}

      <main
        key="main"
        className="flex w-full grow flex-col items-center justify-center overflow-hidden p-6"
      >
        {logo && (
          <img
            key="logo"
            src={logo}
            alt={name || t`Logo`}
            aria-hidden
            className="mb-4 h-16 w-16 md:mb-8 md:h-24 md:w-24"
          />
        )}

        {title && (
          <h1
            key="title"
            className="text-primary mx-4 mb-4 text-center text-2xl font-bold md:mb-8 md:text-4xl"
          >
            {title}
          </h1>
        )}

        {children}
      </main>

      <PageFooter links={links} />
    </div>
  )
}

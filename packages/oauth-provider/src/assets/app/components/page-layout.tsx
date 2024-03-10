import { HTMLAttributes, PropsWithChildren, ReactNode } from 'react'

export type PageLayoutProps = PropsWithChildren<{
  title?: ReactNode
  subtitle?: ReactNode
}>

export function PageLayout({
  children,
  title,
  subtitle,
  ...props
}: PageLayoutProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof PageLayoutProps>) {
  return (
    <div
      {...props}
      className={`${
        props.className || ''
      } flex justify-center items-stretch h-screen bg-white text-black dark:bg-black dark:text-white`}
    >
      <div className="w-1/2 hidden p-4 md:grid content-center justify-items-end text-right dark:bg-transparent dark:border-r bg-slate-100 dark:bg-slate-950">
        {title && (
          <h1 className="text-3xl lg:text-5xl mt-4 font-semibold mb-4 text-primary">
            {title}
          </h1>
        )}

        {subtitle && (
          <p className="max-w-xs text-slate-500 dark:text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center w-full justify-center p-6 md:justify-start md:p-12">
        {children}
      </div>
    </div>
  )
}

import { HTMLAttributes } from 'react'

export type PageLayoutProps = {
  column?: string | JSX.Element
  children: string | JSX.Element
}

export function PageLayout({
  column,
  children,
  className,
  ...props
}: PageLayoutProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`${
        className || ''
      } flex justify-center items-stretch h-screen bg-white text-black dark:bg-black dark:text-white`}
      {...props}
    >
      <div className="w-1/2 hidden p-4 md:grid content-center justify-items-end text-right dark:bg-transparent dark:border-r bg-column dark:bg-slate-950">
        {column}
      </div>

      <div className="flex items-center w-full justify-center p-6 md:justify-start md:p-12">
        {children}
      </div>
    </div>
  )
}

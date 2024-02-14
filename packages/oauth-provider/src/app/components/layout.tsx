import { HTMLAttributes } from 'react'

export function Layout({
  title,
  subTitle,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string | JSX.Element
  subTitle?: string | JSX.Element
  children?: string | JSX.Element
}) {
  return (
    <div
      className="flex justify-center items-stretch h-screen bg-white dark:bg-black dark:text-white"
      {...props}
    >
      <div className="w-1/2 hidden p-4 md:grid content-center justify-items-end text-right bg-slate-100 dark:bg-transparent dark:border-r border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl mt-4 font-semibold mb-4 text-blue-600">
          {title}
        </h1>
        <p className="min-h-16">{subTitle}</p>
      </div>

      <div className="flex items-center w-full justify-center p-6 md:justify-start md:p-12">
        {children}
      </div>
    </div>
  )
}

import { ReactNode } from 'react'

export function Layout({
  children,
  nav,
}: {
  children: ReactNode
  nav?: ReactNode
}) {
  return (
    <div className="container mx-auto flex min-h-screen max-w-3xl flex-col p-4">
      <nav className="mb-8 flex items-center">
        <div className="flex-1" />
        {nav}
      </nav>
      <main className="flex flex-1 flex-col items-stretch space-y-4">
        {children}
      </main>
    </div>
  )
}

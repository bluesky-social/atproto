import { clsx } from 'clsx'

export function Outer({ children }: { children: React.ReactNode }) {
  return <main className="px-4 md:px-6">{children}</main>
}

export function Center({
  children,
  className,
  style = {},
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={clsx(['mx-auto w-full py-10', className])}
      style={{ maxWidth: 600, ...style }}
    >
      {children}
    </div>
  )
}

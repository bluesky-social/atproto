const sizes = {
  sm: 20,
  md: 28,
  lg: 36,
}

export function Loader({
  fill = 'var(--color-primary)',
  size: sizeName = 'md',
  width,
}: {
  fill?: string
  size?: 'sm' | 'md' | 'lg'
  width?: number
}) {
  const size = sizes[sizeName] || width

  return (
    <div
      className="align-center relative justify-center"
      style={{ width: size, height: size }}
    >
      <div className="loader-animation">
        <svg fill="none" viewBox="0 0 24 24" width={size} height={size}>
          <path
            fill={fill || 'var(--color-primary)'}
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 5a7 7 0 0 0-5.218 11.666A1 1 0 0 1 5.292 18a9 9 0 1 1 13.416 0 1 1 0 1 1-1.49-1.334A7 7 0 0 0 12 5Z"
          />
        </svg>
      </div>
    </div>
  )
}

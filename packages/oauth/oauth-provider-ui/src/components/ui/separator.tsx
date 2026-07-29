import { Separator as SeparatorPrimitive } from '@base-ui/react/separator'
import { cn } from '#/lib/utils.ts'

function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch shrink-0',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number // 0 to 100
  indicatorClassName?: string
}

function Progress({ className, value = 0, indicatorClassName, ...props }: ProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100)

  return (
    <div
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 bg-primary transition-all duration-300 ease-in-out",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </div>
  )
}

export { Progress }

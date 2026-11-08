/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-white shadow-xs hover:bg-destructive/80",
        outline: "border-border text-foreground",
        blue: "border-transparent bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400",
        emerald:
          "border-transparent bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400",
        amber:
          "border-transparent bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400",
        purple:
          "border-transparent bg-purple-500/10 font-medium text-purple-600 dark:text-purple-400",
        rose: "border-transparent bg-rose-500/10 font-medium text-rose-600 dark:text-rose-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

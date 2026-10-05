import * as React from "react"
import { cn } from "../../lib/utils"

// Based on shadcn/ui alert, imported 2026-10-05. Static notes do not use live-region role=alert.
function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert" role="note" className={cn("rounded-lg border bg-card p-4 text-sm text-card-foreground", className)} {...props} />
}
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-semibold", className)} {...props} />
}
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("text-muted-foreground", className)} {...props} />
}
export { Alert, AlertTitle, AlertDescription }

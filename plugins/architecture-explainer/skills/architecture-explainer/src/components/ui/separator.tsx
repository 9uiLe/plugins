import * as React from "react"
import { cn } from "../../lib/utils"

// Based on shadcn/ui separator, imported 2026-10-05. Native hr needs no Radix runtime.
function Separator({ className, ...props }: React.ComponentProps<"hr">) {
  return <hr data-slot="separator" className={cn("my-3 border-0 border-t border-border", className)} {...props} />
}
export { Separator }

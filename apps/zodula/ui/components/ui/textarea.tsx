import * as React from "react"

import { cn } from "@/zodula/ui/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "zd:bg-muted zd:w-full zd:resize-none zd:rounded-md zd:p-2 zd:px-3 zd:min-h-32",
        className ?? ""
      )}
      {...props}
    />
  )
}

export { Textarea }

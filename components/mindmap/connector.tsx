import { ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Visual "branch" between two mind-map columns — lights up once a selection has been made upstream. */
export function Connector({ active, color }: { active: boolean; color?: string }) {
  return (
    <div className="relative flex w-8 shrink-0 flex-col items-center justify-center sm:w-10" aria-hidden="true">
      <div
        className={cn("h-full w-px transition-colors duration-300", active ? "" : "bg-border")}
        style={active ? { backgroundColor: color ?? "var(--primary)" } : undefined}
      />
      <div
        className={cn(
          "absolute flex size-6 items-center justify-center rounded-full border transition-colors duration-300",
          active ? "border-transparent text-primary-foreground" : "border-border bg-card text-muted-foreground",
        )}
        style={active ? { backgroundColor: color ?? "var(--primary)" } : undefined}
      >
        <ChevronRightIcon className="size-3.5" />
      </div>
    </div>
  )
}

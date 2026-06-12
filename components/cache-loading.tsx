"use client"

import { Loader2Icon } from "lucide-react"

/**
 * Loading skeleton shown while the DataCache is initialising.
 * Used only during the very first page load; after that the cache
 * is always warm so this never shows again.
 */
export function CacheLoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2Icon className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading data…</p>
      </div>
    </div>
  )
}

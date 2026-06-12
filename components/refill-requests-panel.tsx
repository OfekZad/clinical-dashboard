"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { RefillRequest } from "@/app/api/refill-requests/route"

const STATUS_STYLES: Record<RefillRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function RefillRequestsPanel() {
  const [requests, setRequests] = useState<RefillRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/refill-requests")
      if (res.ok) setRequests(await res.json())
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
    const id = setInterval(fetchRequests, 30_000)
    return () => clearInterval(id)
  }, [fetchRequests])

  const updateStatus = async (id: string, status: "approved" | "denied") => {
    setUpdating(id)
    try {
      await fetch("/api/refill-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      await fetchRequests()
    } finally {
      setUpdating(null)
    }
  }

  const pending = requests.filter((r) => r.status === "pending")
  const recent = requests.filter((r) => r.status !== "pending").slice(0, 5)

  if (loading) return null
  if (requests.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">💊</span>
        <h2 className="text-lg font-semibold tracking-tight">
          Refill Requests
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {pending.length}
            </span>
          )}
        </h2>
        <span className="text-xs text-muted-foreground ml-auto">
          Joy SMS assistant
        </span>
      </div>

      <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
        {pending.length === 0 && recent.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground">No refill requests.</div>
        )}

        {pending.map((req) => (
          <div key={req.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{req.patient_name ?? "Unknown"}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground truncate">{req.medication_name}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_STYLES[req.status],
                  )}
                >
                  {req.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">via SMS · {timeAgo(req.created_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => updateStatus(req.id, "approved")}
                disabled={!!updating}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
                  "dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60",
                  updating === req.id && "opacity-50 cursor-not-allowed",
                )}
              >
                Approve
              </button>
              <button
                onClick={() => updateStatus(req.id, "denied")}
                disabled={!!updating}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  "bg-red-100 text-red-800 hover:bg-red-200",
                  "dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60",
                  updating === req.id && "opacity-50 cursor-not-allowed",
                )}
              >
                Deny
              </button>
            </div>
          </div>
        ))}

        {recent.map((req) => (
          <div key={req.id} className="flex items-center gap-3 px-4 py-2.5 opacity-60">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm truncate">{req.patient_name ?? "Unknown"}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground truncate">{req.medication_name}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_STYLES[req.status],
                  )}
                >
                  {req.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

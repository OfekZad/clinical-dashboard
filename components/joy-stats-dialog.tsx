'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { JoyState, JoyStats } from "./joy-indicator"

interface StateConfig {
  emoji: string
  label: string
  bgClass: string
  pulseClass: string
  textClass: string
  borderClass: string
}

interface JoyStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: JoyStats
  currentState: JoyState
  stateConfig: StateConfig
}

export function JoyStatsDialog({
  open,
  onOpenChange,
  stats,
  currentState,
  stateConfig,
}: JoyStatsDialogProps) {
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const statCards: Array<{
    label: string
    value: string
    icon: string
    colorClass: string
  }> = [
    {
      label: "Calls Taken Today",
      value: String(stats.callsToday),
      icon: "📞",
      colorClass: "bg-warning/10 border-warning/20",
    },
    {
      label: "OSDI Reports Completed",
      value: String(stats.osdiReportsToday),
      icon: "📋",
      colorClass: "bg-info/10 border-info/20",
    },
    {
      label: "Escalations Today",
      value: String(stats.escalationsToday),
      icon: "🚨",
      colorClass: "bg-destructive/10 border-destructive/20",
    },
    {
      label: "Total Call Time",
      value: formatTime(stats.totalCallTimeMinutes),
      icon: "⏱️",
      colorClass: "bg-chart-1/10 border-chart-1/20",
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <img
              src="/dialdoc.png"
              alt="Joy"
              className="size-14 rounded-full object-cover ring-2 ring-emerald-200 dark:ring-emerald-800"
            />
            <div>
              <DialogTitle className="text-xl">Joy — AI Agent</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 mt-0.5">
                Today&apos;s performance · {todayStr}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current state badge */}
        <div className="flex items-center justify-center gap-2 py-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all duration-500",
              stateConfig.borderClass,
              stateConfig.textClass,
              "bg-background/80",
            )}
          >
            <span
              className={cn(
                "inline-block size-2 rounded-full transition-all duration-500",
                stateConfig.bgClass,
              )}
            />
            <span>{stateConfig.emoji}</span>
            <span>Currently: {stateConfig.label}</span>
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border p-4 text-center transition-all hover:shadow-sm",
                card.colorClass,
              )}
            >
              <span className="text-2xl" role="img" aria-label={card.label}>
                {card.icon}
              </span>
              <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
                {card.value}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground leading-tight">
                {card.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground pt-1">
          Data refreshes in real-time · Updated just now
        </p>
      </DialogContent>
    </Dialog>
  )
}

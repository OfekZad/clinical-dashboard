'use client'

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { JoyStatsDialog } from "./joy-stats-dialog"

export type JoyState = "idle" | "in_call" | "escalating"

export interface JoyStats {
  callsToday: number
  osdiReportsToday: number
  escalationsToday: number
  totalCallTimeMinutes: number
}

const STATE_CONFIG: Record<
  JoyState,
  {
    emoji: string
    label: string
    bgClass: string
    pulseClass: string
    textClass: string
    borderClass: string
  }
> = {
  idle: {
    emoji: "😴",
    label: "Idle",
    bgClass: "bg-emerald-500",
    pulseClass: "shadow-[0_0_12px_2px] shadow-emerald-400/60",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-300",
  },
  in_call: {
    emoji: "📞",
    label: "In a Call",
    bgClass: "bg-amber-500",
    pulseClass: "shadow-[0_0_14px_3px] shadow-amber-400/60",
    textClass: "text-amber-700",
    borderClass: "border-amber-300",
  },
  escalating: {
    emoji: "🚨",
    label: "Escalating",
    bgClass: "bg-red-500",
    pulseClass: "shadow-[0_0_16px_4px] shadow-red-400/65",
    textClass: "text-red-700",
    borderClass: "border-red-300",
  },
}

// Generate deterministic mock stats for demo purposes
function generateMockStats(): JoyStats {
  // Use a seed based on today's date so numbers stay consistent throughout the day
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const pseudoRandom = (n: number) => ((seed * 9301 + 49297) % 233280) / 233280 * n

  return {
    callsToday: Math.floor(pseudoRandom(18)) + 8,           // 8–25
    osdiReportsToday: Math.floor(pseudoRandom(12)) + 5,      // 5–16
    escalationsToday: Math.floor(pseudoRandom(6)) + 1,       // 1–6
    totalCallTimeMinutes: Math.floor(pseudoRandom(120)) + 45, // 45–164
  }
}

export function JoyIndicator() {
  const [state, setState] = useState<JoyState>("idle")
  const [statsOpen, setStatsOpen] = useState(false)
  const [stats] = useState<JoyStats>(generateMockStats)

  // Simulate state cycling for demonstration purposes.
  // In production this would be driven by real backend events.
  useEffect(() => {
    const cycle = async () => {
      // idle for 4–8 seconds
      await sleep(4000 + Math.random() * 4000)
      setState("in_call")

      // in a call for 3–6 seconds
      await sleep(3000 + Math.random() * 3000)
      setState("escalating")

      // escalating for 1.5–3 seconds
      await sleep(1500 + Math.random() * 1500)
      setState("idle")
    }
    let cancelled = false
    const run = async () => {
      while (!cancelled) {
        await cycle()
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const config = STATE_CONFIG[state]

  return (
    <>
      <button
        type="button"
        onClick={() => setStatsOpen(true)}
        className={cn(
          "group relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-500 ease-in-out",
          "hover:scale-105 active:scale-95 cursor-pointer",
          config.borderClass,
          config.textClass,
          "bg-background/90",
          "shadow-sm hover:shadow-md",
        )}
        aria-label={`Joy AI Agent — ${config.label}. Click to view stats.`}
        title={`Joy — ${config.label}`}
      >
        {/* Animated glow dot */}
        <span
          className={cn(
            "absolute inset-0 rounded-full transition-all duration-700 ease-in-out",
            state === "idle" && "animate-joy-pulse-idle",
            state === "in_call" && "animate-joy-pulse-call",
            state === "escalating" && "animate-joy-pulse-escalate",
          )}
          style={{ opacity: 0.35 }}
        />

        {/* Static dot + emoji */}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full transition-all duration-500 ease-in-out",
            config.bgClass,
            config.pulseClass,
          )}
        />
        <span className="relative text-sm leading-none">{config.emoji}</span>
        <span className="relative hidden sm:inline">{config.label}</span>
        <span className="relative text-[10px] opacity-60 transition-opacity group-hover:opacity-100">
          ℹ️
        </span>
      </button>

      <JoyStatsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        stats={stats}
        currentState={state}
        stateConfig={STATE_CONFIG[state]}
      />
    </>
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

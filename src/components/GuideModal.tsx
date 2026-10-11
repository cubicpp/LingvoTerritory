import { useEffect } from "react"
import { GUIDES } from "@/lib/guides"
import { useAppStore } from "@/store/useAppStore"

export function GuideModal({ guideId }: { guideId: string }) {
  const guide = GUIDES[guideId]
  const lang = useAppStore((s) => s.lang)
  const guideOpen = useAppStore((s) => s.guideOpen)
  const setGuideOpen = useAppStore((s) => s.setGuideOpen)
  const title = guide ? (lang === "zh-TW" ? (guide.titleTw || guide.title) : guide.title) : ''

  if (!guide) return null

  return (
    <button
      onClick={() => setGuideOpen(!guideOpen)} title={title} aria-label={title}
      style={{ position: "absolute", top: 10, right: 12, zIndex: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-md)", color: "var(--text-tertiary)", cursor: "pointer", border: "none", background: "var(--glass-3)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", fontSize: 16, lineHeight: 1, transition: "color .15s var(--ease), background .15s var(--ease)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text)"; (e.currentTarget as HTMLElement).style.background = "var(--glass-4)" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLElement).style.background = "var(--glass-3)" }}
    >📖</button>
  )
}

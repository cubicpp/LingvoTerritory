import { useEffect } from "react"
import { GUIDES } from "@/lib/guides"
import { useAppStore } from "@/store/useAppStore"

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 16, height: 16, display: "block" }}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function GuideDrawer({ guideId }: { guideId: string }) {
  const guide = GUIDES[guideId]
  const lang = useAppStore((s) => s.lang)
  const setGuideOpen = useAppStore((s) => s.setGuideOpen)
  const title = guide ? (lang === "zh-TW" ? (guide.titleTw || guide.title) : guide.title) : ''

  const sectionBody = (section: any) => lang === "zh-TW" ? (section.bodyTw || section.body) : section.body
  const sectionHeading = (section: any) => lang === "zh-TW" ? (section.headingTw || section.heading) : section.heading

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGuideOpen(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [setGuideOpen])

  if (!guide) return null

  return (
    <>
      <div className="drawer drawer--open" style={{ zIndex: 250 }}>
        <div className="drawer-body" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px", borderBottom: "0.5px solid var(--border-subtle)", flexShrink: 0,
          }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-lg)", fontWeight: 600, color: "var(--text)", margin: 0 }}>
              {title}
            </h2>
            <button onClick={() => setGuideOpen(false)}
              aria-label={lang === "zh-CN" ? "关闭" : "關閉"}
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", color: "var(--text-tertiary)", cursor: "pointer", border: "none", background: "transparent", fontFamily: "inherit" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--text)"; el.style.background = "var(--glass-2)" }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--text-tertiary)"; el.style.background = "transparent" }}
            ><CloseIcon /></button>
          </div>
          <div style={{ padding: "20px", overflowY: "auto", flex: 1, fontSize: "var(--fs-sm)", lineHeight: 1.85, color: "var(--text-secondary)" }}>
            {guide.sections.map((section: any, i: number) => (
              <div key={i}>
                <h3 style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--text)", margin: i === 0 ? "0 0 8px" : "20px 0 8px", fontFamily: "var(--font-serif)" }}>
                  {sectionHeading(section)}
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: "16px", lineHeight: 1.8 }}>{sectionBody(section)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

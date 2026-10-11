import { useCallback, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/store/useAppStore'
import { toggleTheme } from '@/lib/theme'
import type { FontStyle, FontSize } from '@/store/useAppStore'

const ITEMS = [
  { key: 'theme', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', action: 'theme', label: { 'zh-CN': '深色', 'zh-TW': '深色' } },
  { key: 'font', icon: 'M11 4h2l6 16h-2.5l-1.5-4H9l-1.5 4H5L11 4z', action: 'font', label: { 'zh-CN': '衬线', 'zh-TW': '襯線' } },
  { key: 'size', icon: 'M3 7V5h14v2zm0 4v-2h14v2zm0 4v-2h9v2zm0 4v-2h6v2z', action: 'size', label: { 'zh-CN': '较大', 'zh-TW': '較大' } },
  { key: 'lang', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1 17.93A8 8 0 015.07 13H7v-2H5.07A8 8 0 0111 4.07V7h2V4.07A8 8 0 0118.93 11H17v2h1.93A8 8 0 0113 19.93V17h-2v2.93z', action: 'lang', label: { 'zh-CN': '繁体', 'zh-TW': '簡體' } },
  { key: 'motion', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z', action: 'motion', label: { 'zh-CN': '动效', 'zh-TW': '動效' } },
]

export function RadialMenu() {
  const open = useAppStore((s) => s.radialOpen)
  const close = useAppStore((s) => s.closeRadial)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const fontStyle = useAppStore((s) => s.fontStyle)
  const setFontStyle = useAppStore((s) => s.setFontStyle)
  const fontSize = useAppStore((s) => s.fontSize)
  const setFontSize = useAppStore((s) => s.setFontSize)
  const lang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const toggleReducedMotion = useAppStore((s) => s.toggleReducedMotion)

  const [mounted, setMounted] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  const portalEl = useRef<HTMLDivElement | null>(null)

  // Create portal container in body
  useEffect(() => {
    const el = document.createElement('div')
    el.id = 'radial-portal'
    document.body.appendChild(el)
    portalEl.current = el
    return () => { el.remove(); portalEl.current = null }
  }, [])

  // Mount / unmount with transition choreography
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true))
      })
      return () => cancelAnimationFrame(raf)
    } else {
      setAnimateIn(false)
      const timer = setTimeout(() => setMounted(false), 350)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!mounted || !portalEl.current) return null

  const itemCount = ITEMS.length
  const radius = 100

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'theme': setTheme(toggleTheme(theme)); break
        case 'font': setFontStyle(fontStyle === 'sans' ? 'serif' : 'sans'); break
        case 'size': setFontSize(fontSize === 'standard' ? 'large' : 'standard'); break
        case 'lang': setLang(lang === 'zh-CN' ? 'zh-TW' : 'zh-CN'); break
        case 'motion': toggleReducedMotion(); break
      }
      close()
    },
    [theme, setTheme, fontStyle, setFontStyle, fontSize, setFontSize, lang, setLang, toggleReducedMotion, close]
  )

  return createPortal(
    <>
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(0,0,0,0.4)',
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 0.3s var(--ease)',
        }}
      />
      <div
        style={{
          position: 'fixed', bottom: 40, right: 20, zIndex: 401,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'scale(1)' : 'scale(0.9)',
          transition: 'opacity 0.3s var(--ease), transform 0.3s var(--ease)',
        }}
      >
        {ITEMS.map((item, i) => {
          const angle = (i / itemCount) * Math.PI * 2 - Math.PI / 2
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          let isActive = false
          if (item.action === 'theme') isActive = theme === 'dark'
          else if (item.action === 'font') isActive = fontStyle === 'serif'
          else if (item.action === 'size') isActive = fontSize === 'large'
          else if (item.action === 'lang') isActive = lang === 'zh-TW'
          else if (item.action === 'motion') isActive = reducedMotion
          return (
            <button key={item.key}
              className={`radial-menu__item ${animateIn ? 'radial-menu__item--visible' : ''} ${isActive ? 'radial-menu__item--active' : ''}`}
              style={{
                position: 'absolute',
                transform: `translate(${animateIn ? x : 0}px, ${animateIn ? y : 0}px) scale(${isActive ? 1.1 : 1})`,
                transition: `all .25s cubic-bezier(0.34,1.56,0.64,1) ${i * 30}ms`,
              }}
              onClick={() => handleAction(item.action)}
              aria-label={item.key}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d={item.icon} />
              </svg>
              <span>{item.label[lang]}</span>
            </button>
          )
        })}
        <div className="radial-menu__center" onClick={close} style={{ position: 'absolute' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
      </div>
    </>,
    portalEl.current
  )
}

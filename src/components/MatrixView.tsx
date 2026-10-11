/**
 * MatrixView.tsx — 中古音声母 × 攝 配合矩阵
 * v6.0: merged with ZymyView + RoseView — tab switching (广韵/集韵/中原音韵/南丁格尔)
 */
import { useRef, useEffect, useState, useMemo } from "react"
import * as echarts from "echarts"
import { useAppStore } from "@/store/useAppStore"
import { safeDispose } from "@/lib/safeDispose"
import { LegendList, MetricStrip, RailSection, ResearchLayout } from "@/components/ui/ResearchLayout"

type MatrixMode = "guangyun_heat" | "guangyun_rose" | "jiyun_heat" | "jiyun_rose" | "zhongyuan_heat" | "zhongyuan_rose"

const MODE_TABS: MatrixMode[] = [
  "guangyun_heat", "guangyun_rose",
  "jiyun_heat", "jiyun_rose",
  "zhongyuan_heat", "zhongyuan_rose",
]

const MODE_LABELS: Record<MatrixMode, string> = {
  guangyun_heat: "广韵（热力）", guangyun_rose: "广韵（南丁格尔）",
  jiyun_heat: "集韵（热力）", jiyun_rose: "集韵（南丁格尔）",
  zhongyuan_heat: "中原音韵（热力）", zhongyuan_rose: "中原音韵（南丁格尔）",
}
const MODE_LABELS_TW: Record<MatrixMode, string> = {
  guangyun_heat: "廣韻（熱力）", guangyun_rose: "廣韻（南丁格爾）",
  jiyun_heat: "集韻（熱力）", jiyun_rose: "集韻（南丁格爾）",
  zhongyuan_heat: "中原音韻（熱力）", zhongyuan_rose: "中原音韻（南丁格爾）",
}

function modeSource(m: MatrixMode): "guangyun" | "jiyun" | "zhongyuan" {
  if (m.startsWith("guangyun")) return "guangyun"
  if (m.startsWith("jiyun")) return "jiyun"
  return "zhongyuan"
}

function modeIsRose(m: MatrixMode) { return m.endsWith("_rose") }

const INITIAL_41_MAP: Record<string, string> = {
  "幫": "幫(唇)", "滂": "滂(唇)", "並": "並(唇)", "明": "明(唇)",
  "非": "非(唇)", "敷": "敷(唇)", "奉": "奉(唇)", "微": "微(唇)",
  "端": "端(舌)", "透": "透(舌)", "定": "定(舌)", "泥": "泥(舌)",
  "知": "知(舌)", "徹": "徹(舌)", "澄": "澄(舌)", "娘": "娘(舌)",
  "見": "見(牙)", "溪": "溪(牙)", "羣": "羣(牙)", "疑": "疑(牙)",
  "精": "精(齿)", "清": "清(齿)", "從": "從(齿)", "心": "心(齿)", "邪": "邪(齿)",
  "莊": "莊(齿)", "初": "初(齿)", "崇": "崇(齿)", "生": "生(齿)",
  "章": "章(齿)", "昌": "昌(齿)", "船": "船(齿)", "書": "書(齿)", "禪": "禪(齿)",
  "影": "影(喉)", "曉": "曉(喉)", "匣": "匣(喉)", "喻": "喻(喉)",
  "來": "來(舌)", "日": "日(齿)",
  "云": "喻(喉)", "以": "喻(喉)", "孃": "娘(舌)", "常": "禪(齿)", "俟": "俟(齿)",
}

const ALL_41_GROUPS = [
  "幫(唇)", "滂(唇)", "並(唇)", "明(唇)",
  "端(舌)", "透(舌)", "定(舌)", "泥(舌)",
  "非(唇)",
  "知(舌)", "徹(舌)", "澄(舌)", "娘(舌)",
  "見(牙)", "溪(牙)", "羣(牙)", "疑(牙)",
  "敷(唇)",
  "精(齿)", "清(齿)", "從(齿)", "心(齿)", "邪(齿)",
  "莊(齿)", "初(齿)", "崇(齿)", "生(齿)",
  "奉(唇)",
  "章(齿)", "昌(齿)", "船(齿)", "書(齿)", "禪(齿)",
  "影(喉)", "曉(喉)", "匣(喉)", "喻(喉)",
  "微(唇)",
  "來(舌)", "日(齿)", "俟(齿)",
]

function extractBase(init: string): string {
  return init.replace(/[開合ABCDEFGHJKMNPQRSUVWXYZ一二三四五六七八九十]+$/g, "")
}

function getMergedGroup(init: string): string {
  const base = extractBase(init)
  return INITIAL_41_MAP[base] ?? base
}

export function MatrixView() {
  const heatmapRef = useRef<HTMLDivElement>(null)
  const roseRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const mcPhonology = useAppStore((s) => s.dataCache.mcPhonology)
  const theme = useAppStore((s) => s.theme)
  const lang = useAppStore((s) => s.lang)
  const selectDialect = useAppStore((s) => s.selectDialect)
  const setSubMode = useAppStore((s) => s.setSubMode)

  const [mode, setMode] = useState<MatrixMode>("guangyun_heat")
  const [showValues, setShowValues] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [useMerged, setUseMerged] = useState(true)

  const [jyData, setJyData] = useState<any>(null)
  const [zyData, setZyData] = useState<any>(null)

  const dk = theme === "dark"

  useEffect(() => {
    fetch("/data/jy_phonology.json").then(r => r.json()).then(setJyData).catch(() => {})
    fetch("/data/zymy_phonology.json").then(r => r.json()).then(d => {
      if (d?.finals && d?.matrix && !d.she) {
        const sheSet = new Map<string, number>()
        const sheList: string[] = []
        for (const f of d.finals as string[]) {
          const she = f.replace(/[開合齊撮]/, "").replace(/[一二三四]$/, "")
          if (!sheSet.has(she)) { sheSet.set(she, sheList.length); sheList.push(she) }
        }
        const finalToShe = (d.finals as string[]).map((f: string) => {
          const sh = f.replace(/[開合齊撮]/, "").replace(/[一二三四]$/, "")
          return sheSet.get(sh) ?? -1
        })
        const sheMatrix = (d.matrix as number[][]).map((row: number[]) => {
          const agg = Array(sheList.length).fill(0)
          for (let j = 0; j < row.length; j++) {
            const si = finalToShe[j]
            if (si >= 0) agg[si] += row[j] || 0
          }
          return agg
        })
        d.she = sheList
        d.sheMatrix = sheMatrix
      }
      setZyData(d)
    }).catch(() => {})
  }, [])

  const activePhonology = useMemo(() => {
    const src = modeSource(mode)
    if (src === "jiyun" && jyData) return jyData
    if (src === "zhongyuan" && zyData) return zyData
    return mcPhonology
  }, [mode, mcPhonology, jyData, zyData])

  const { effectiveInit, effectiveMatrix } = useMemo(() => {
    if (!activePhonology || !activePhonology.she.length) {
      return { effectiveInit: [], effectiveMatrix: [] as number[][] }
    }
    const { initials, sheMatrix } = activePhonology
    if (!sheMatrix?.length) return { effectiveInit: [], effectiveMatrix: [] as number[][] }

    if (modeSource(mode) === "jiyun" || modeSource(mode) === "zhongyuan") {
      return { effectiveInit: initials as string[], effectiveMatrix: sheMatrix }
    }

    if (!useMerged) {
      return { effectiveInit: initials as string[], effectiveMatrix: sheMatrix }
    }

    const groups = ALL_41_GROUPS
    const groupMap = new Map<string, number[]>()
    for (const grp of groups) {
      groupMap.set(grp, new Array(activePhonology.she.length).fill(0))
    }

    initials.forEach((init: string, i: number) => {
      const group = getMergedGroup(init)
      const row = sheMatrix[i]
      if (!row) return
      const acc = groupMap.get(group)
      if (acc) {
        for (let j = 0; j < row.length; j++) {
          acc[j] += row[j] || 0
        }
      }
    })

    const mergedMatrix = groups.map((g: string) => groupMap.get(g)!)
    return { effectiveInit: groups, effectiveMatrix: mergedMatrix }
  }, [activePhonology, useMerged, mode])

  const dynamicPhonologyStats = useMemo(() => {
    const sheLen = activePhonology?.she?.length ?? 0
    if (!effectiveInit.length || !sheLen) return null
    let nonEmpty = 0
    const allCells: { initial: string; she: string; value: number }[] = []
    for (let i = 0; i < effectiveInit.length; i++) {
      for (let j = 0; j < sheLen; j++) {
        const v = effectiveMatrix[i]?.[j] || 0
        if (v > 0) { nonEmpty++; allCells.push({ initial: effectiveInit[i], she: activePhonology!.she[j], value: v }) }
      }
    }
    allCells.sort((a, b) => b.value - a.value)
    return { emptyRate: 1 - nonEmpty / (effectiveInit.length * sheLen), topCells: allCells.slice(0, 6) }
  }, [effectiveInit, effectiveMatrix, activePhonology])

  // ── Heatmap chart ──
  useEffect(() => {
    if (modeIsRose(mode) || !activePhonology || !heatmapRef.current) return
    const { she } = activePhonology
    if (!she.length || !effectiveInit.length) return

    if (chartRef.current) {
      safeDispose(chartRef.current)
      chartRef.current = null
    }

    const chart = echarts.init(heatmapRef.current, theme === "dark" ? "dark" : undefined)
    chartRef.current = chart

    const topInit: string[] = []
    const topMatrix: number[][] = []
    effectiveInit.forEach((init, i) => {
      topInit.push(init)
      topMatrix.push(effectiveMatrix[i] || [])
    })

    const data: [number, number, number][] = []
    for (let i = 0; i < topInit.length; i++) {
      for (let j = 0; j < she.length; j++) {
        const v = topMatrix[i]?.[j] || 0
        if (v > 0) data.push([j, i, v])
      }
    }
    const maxVal = Math.max(...data.map((d) => d[2]), 1)

    chart.setOption({
      tooltip: {
        position: "top",
        formatter: (p: any) =>
          `<b>${topInit[p.value[1]]}</b> + <b>${she[p.value[0]]}攝</b>: ${p.value[2]} 字`,
      },
      grid: { left: 88, right: 20, top: 16, bottom: 64 },
      xAxis: {
        type: "category",
        data: she.map((s: string) => s + "攝"),
        axisLabel: { fontSize: 8, hideOverlap: false, color: dk ? "#a39d96" : "#8c857a" },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: {
          show: showGrid,
          lineStyle: { type: "solid", color: dk ? "#3d3226" : "#d0c8b8", width: 0.5 },
        },
        position: "bottom",
      },
      yAxis: {
        type: "category",
        data: topInit,
        axisLabel: { fontSize: 6, hideOverlap: false, interval: 0, color: dk ? "#a39d96" : "#1a1814" },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: {
          show: showGrid,
          lineStyle: { type: "solid", color: dk ? "#3d3226" : "#d0c8b8", width: 0.5 },
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: "vertical",
        left: 4,
        top: "center",
        inRange: {
          color: dk
            ? ["#1a1512", "#5c2a1e", "#c45a4a", "#e8a090"]
            : ["#faf6f0", "#e8c4a0", "#c43a31", "#6b1515"],
        },
        textStyle: { color: dk ? "#a39d96" : "#8c857a", fontSize: 10 },
      },
      series: [
        {
          name: "字次",
          type: "heatmap",
          data,
          label: { show: showValues, fontSize: 9, color: dk ? "#e8e4df" : "#3d3226" },
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.3)" },
          },
        },
      ],
    })

    chart.off("click")
    chart.on("click", (p: any) => {
      const init = topInit[p.value?.[1]]
      const sh = she[p.value?.[0]]
      if (!init || !sh) return
      const details = (activePhonology as any)?.charDetails
      if (!details) return
      let chars: any[] = []
      for (const key of Object.keys(details)) {
        const [kInit, kShe] = key.split("||")
        if (kShe !== sh) continue
        const base = init.replace(/\(.*\)/, "").replace(/[開合]$/, "")
        if (kInit === base || kInit.startsWith(base)) {
          chars = chars.concat(details[key])
        }
      }
      if (chars.length > 0) {
        const sp = {
          id: `__mc__${init}_${sh}`,
          name: `${init} + ${sh}攝`,
          title: `${init} + ${sh}攝`,
          lat: 0, lng: 0,
          region: "", group: "", subgroup: "",
          broad: "官话" as any, color: "", symbol: "",
          ydFenqu: "", csFenqu: "", source: "", contributor: "",
          location: "", markerColor: "",
          groupMembers: chars as any,
          _isMcChars: true,
        } as any
        selectDialect(sp)
      }
    })

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(heatmapRef.current)
    return () => {
      ro.disconnect()
      safeDispose(chart)
      chartRef.current = null
    }
  }, [activePhonology, effectiveInit, effectiveMatrix, dk, mode])

  useEffect(() => {
    if (!chartRef.current || modeIsRose(mode)) return
    chartRef.current.setOption({
      series: [{ label: { show: showValues } }],
      xAxis: { splitLine: { show: showGrid } },
      yAxis: { splitLine: { show: showGrid } },
    })
  }, [showValues, showGrid, mode])

  // ── Rose chart data ──
  const sheNames = useMemo(() => {
    if (!activePhonology?.she) return [] as string[]
    return activePhonology.she
  }, [activePhonology])

  const sheTotals = useMemo(() => {
    if (!activePhonology?.sheMatrix || !sheNames.length) return [] as { name: string; value: number }[]
    const totals: number[] = Array(sheNames.length).fill(0)
    for (const row of activePhonology.sheMatrix) {
      for (let j = 0; j < row.length; j++) {
        totals[j] += row[j] || 0
      }
    }
    const data: { name: string; value: number }[] = sheNames.map((name: string, i: number) => ({ name: name + "攝", value: totals[i] }))
    data.sort((a, b) => b.value - a.value)
    return data
  }, [activePhonology, sheNames])

  // ── Rose chart ──
  useEffect(() => {
    if (!modeIsRose(mode) || !roseRef.current || !sheTotals.length) return

    if (chartRef.current) {
      safeDispose(chartRef.current)
      chartRef.current = null
    }

    const chart = echarts.init(roseRef.current, theme === "dark" ? "dark" : undefined)
    chartRef.current = chart

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (p: any) => `${p.name}<br/>字数: <b>${p.value}</b>`,
      },
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 10,
        top: 20,
        bottom: 20,
        textStyle: { color: dk ? "#a39d96" : "#5c5650", fontSize: 12 },
      },
      series: [
        {
          name: "字次",
          type: "pie",
          radius: ["10%", "80%"],
          center: ["40%", "50%"],
          roseType: "area",
          itemStyle: { borderRadius: 6, borderColor: dk ? "#111620" : "#fff", borderWidth: 2 },
          label: {
            fontSize: 11,
            color: dk ? "#a39d96" : "#5c5650",
            formatter: "{b}\n{d}%",
          },
          emphasis: {
            label: { fontSize: 18, fontWeight: "bold" },
            itemStyle: { shadowBlur: 16, shadowColor: "rgba(0,0,0,0.3)" },
          },
          data: sheTotals,
        },
      ],
    })

    chart.off("click")
    chart.on("click", (p: any) => {
      const she = (p.name as string)?.replace("攝", "")
      if (!she) return
      const details = (activePhonology as any)?.charDetails
      if (!details) return
      let chars: any[] = []
      for (const key of Object.keys(details)) {
        const [, kShe] = key.split("||")
        if (kShe === she) chars = chars.concat(details[key])
      }
      if (chars.length > 0) {
        selectDialect({
          id: `__mc__she_${she}`,
          name: `${she}攝`,
          title: `${she}攝`,
          lat: 0, lng: 0,
          region: "", group: "", subgroup: "",
          broad: "官话" as any, color: "", symbol: "",
          ydFenqu: "", csFenqu: "", source: "", contributor: "",
          location: "", markerColor: "",
          groupMembers: chars as any,
          _isMcChars: true,
        } as any)
      }
    })

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(roseRef.current)
    return () => { ro.disconnect(); safeDispose(chart); chartRef.current = null }
  }, [mode, sheTotals, dk, activePhonology, selectDialect])

  const displayPhonology = activePhonology

  if (!displayPhonology || !displayPhonology.she?.length) {
    return (
      <div className="loading-screen">
        <div className="loading-blob" />
        <span className="loading-label">{lang === "zh-CN" ? "加载音韵数据..." : "載入音韻資料..."}</span>
      </div>
    )
  }

  const rail = (
    <>
      <RailSection title={lang === "zh-CN" ? "材料与图形" : "材料與圖形"}>
        <div className="rail-mode-list">
          {MODE_TABS.map((m) => (
            <button
              type="button"
              key={m}
              className={`rail-mode-list__item${mode === m ? " active" : ""}`}
              onClick={() => { setMode(m); setSubMode(m); }}
            >
              {(lang === "zh-CN" ? MODE_LABELS[m] : MODE_LABELS_TW[m]) || m}
            </button>
          ))}
        </div>
      </RailSection>
      {!modeIsRose(mode) && (
        <RailSection title={lang === "zh-CN" ? "图层" : "圖層"}>
          <label className="rail-check">
            <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
            <span>{lang === "zh-CN" ? "显示数值" : "顯示數值"}</span>
          </label>
          <label className="rail-check">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            <span>{lang === "zh-CN" ? "显示网格" : "顯示網格"}</span>
          </label>
          {modeSource(mode) === "guangyun" && (
            <label className="rail-check">
              <input type="checkbox" checked={!useMerged} onChange={(e) => setUseMerged(!e.target.checked)} />
              <span>{lang === "zh-CN" ? "高细粒度" : "高細粒度"}</span>
            </label>
          )}
        </RailSection>
      )}
      {dynamicPhonologyStats ? (
        <RailSection title={lang === "zh-CN" ? "结构注释" : "結構註釋"}>
          <MetricStrip
            items={[
              { label: lang === "zh-CN" ? "空白格" : "空白格", value: `${Math.round((dynamicPhonologyStats.emptyRate || 0) * 1000) / 10}%`, tone: "accent" },
              { label: lang === "zh-CN" ? "高频格" : "高頻格", value: dynamicPhonologyStats.topCells?.length || 0 },
            ]}
          />
          <div style={{ height: 8 }} />
          <LegendList
            items={(dynamicPhonologyStats.topCells ?? []).slice(0, 6).map((cell) => ({
              key: `${cell.initial}-${cell.she}`,
              label: `${cell.initial}+${cell.she}攝`,
              value: cell.value,
              color: "var(--accent)",
            }))}
          />
        </RailSection>
      ) : null}
    </>
  )

  return (
    <ResearchLayout rail={rail} railKicker="Phonology" railTitle={lang === "zh-CN" ? "声韵结构" : "聲韻結構"}>
      {!modeIsRose(mode) ? (
        <div ref={heatmapRef} style={{ width: "100%", height: "100%" }} />
      ) : (
        <div ref={roseRef} style={{ width: "100%", height: "100%" }} />
      )}
    </ResearchLayout>
  )
}

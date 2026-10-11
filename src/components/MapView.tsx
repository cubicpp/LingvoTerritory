import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useAppStore, BROAD_COLORS } from '@/store/useAppStore';
import { safeDispose } from '@/lib/safeDispose';
import { useInsights } from '@/hooks/useInsights';
import { LegendList, MetricStrip, RailSection, ResearchLayout, SegmentedControl } from '@/components/ui/ResearchLayout';

let mapRegistered = false;

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const dataCache = useAppStore((s) => s.dataCache);
  const selectedDialect = useAppStore((s) => s.selectedDialect);
  const hoveredDialectId = useAppStore((s) => s.hoveredDialectId);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const hoverDialect = useAppStore((s) => s.hoverDialect);
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const selId = selectedDialect?.id ?? '';
  const hovId = hoveredDialectId ?? '';
  const dk = theme === 'dark';
  const [mapMode, setMapMode] = useState<'points' | 'density'>('points');
  const [focusBroad, setFocusBroad] = useState<string | null>(null);
  const insights = useInsights();

  const groupCounts = useMemo(() => {
    const points = dataCache?.dialects?.points ?? [];
    const counts = new Map<string, number>();
    for (const p of points) counts.set(p.broad, (counts.get(p.broad) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([name]) => name && name !== '未分类');
  }, [dataCache?.dialects]);
  const focusStats = insights?.groupStats?.groups.find((g) => g.broad === focusBroad);
  const points = dataCache?.dialects?.points ?? [];

  useEffect(() => {
    if (!dataCache?.china || mapRegistered) return;
    echarts.registerMap('china', dataCache.china as never);
    mapRegistered = true;
  }, [dataCache]);

  // Initial render + theme change — full setOption with geo (preserves zoom via merge)
  useEffect(() => {
    if (!points.length || !ref.current) return;
    if (!chart.current) chart.current = echarts.init(ref.current, theme === "dark" ? "dark" : undefined);
    const c = chart.current;

    const scatterData = points.map((d) => ({
      name: d.title || d.name, value: [d.lng, d.lat, d.id, d.broad],
      symbolSize: 3,
      itemStyle: {
        color: BROAD_COLORS[d.broad] || BROAD_COLORS['未分类'],
        borderColor: dk ? '#111620' : '#fff', borderWidth: 1,
        opacity: focusBroad && d.broad !== focusBroad ? 0.16 : 0.86,
      },
      label: { show: false },
    }));

    const grid = new Map<string, { lng: number; lat: number; count: number }>();
    for (const d of points) {
      if (focusBroad && d.broad !== focusBroad) continue;
      const lng = Math.round(d.lng * 2) / 2;
      const lat = Math.round(d.lat * 2) / 2;
      const key = `${lng},${lat}`;
      const cur = grid.get(key) ?? { lng, lat, count: 0 };
      cur.count += 1;
      grid.set(key, cur);
    }
    const heatmapData = Array.from(grid.values()).map((d) => [d.lng, d.lat, d.count]);
    const maxHeat = Math.max(...heatmapData.map((d) => d[2]), 1);

    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' as const, backgroundColor: dk ? '#181d28' : '#fff', borderColor: dk ? '#282d38' : '#e5e0d5', textStyle: { color: dk ? '#e8e4df' : '#1a1814', fontSize: 12 } },
      visualMap: mapMode === 'density' ? {
        show: true,
        min: 0,
        max: maxHeat,
        left: 16,
        bottom: 18,
        calculable: true,
        inRange: { color: dk ? ['#1d2533', '#58745b', '#c49c45', '#d85b46'] : ['#f6f1e7', '#c7d8a0', '#e7b956', '#b8322c'] },
        textStyle: { color: dk ? '#a39d96' : '#5c5650', fontSize: 10 },
      } : { show: false },
      toolbox: { show: true, feature: { zoom: { title: { zoom: lang === "zh-CN" ? "放大" : "放大", back: lang === "zh-CN" ? "还原" : "還原" } }, restore: { title: lang === "zh-CN" ? "还原" : "還原" } }, right: 16, top: 8 },
      geo: { map: 'china', roam: true, zoom: 1.25, center: [104, 36], scaleLimit: { min: 0.8, max: 8 }, itemStyle: { areaColor: dk ? '#151b26' : '#f2f0eb', borderColor: dk ? '#282d38' : '#d6d3d1', borderWidth: 0.5 }, emphasis: { disabled: true } },
      series: mapMode === 'density'
        ? [{
            type: 'heatmap' as const,
            coordinateSystem: 'geo' as const,
            data: heatmapData,
            pointSize: 9,
            blurSize: 8,
          }]
        : [{ type: 'scatter' as const, coordinateSystem: 'geo' as const, data: scatterData, emphasis: { scale: 1.5 } }],
    }, true);

    c.off('click'); c.off('mouseover'); c.off('mouseout');
    c.on('click', (p: unknown) => {
      const val = (p as { data?: { value?: unknown[] } }).data?.value;
      const id = val?.[2] as string | undefined;
      if (!id || !points) return;
      const found = points.find((x) => x.id === id);
      selectDialect(selId === id ? null : found ?? null);
    });
    c.on('mouseover', (p: unknown) => {
      const val = (p as { data?: { value?: unknown[] } }).data?.value;
      const id = val?.[2] as string | undefined;
      if (id) hoverDialect(id);
    });
    c.on('mouseout', () => hoverDialect(null));
  }, [points, dk, focusBroad, mapMode, lang]);

  // Incremental update — only update series data on hover/select, NO geo (preserves zoom)
  useEffect(() => {
    if (!points.length || !chart.current) return;
    const c = chart.current;

    const scatterData = points.map((d) => ({
      name: d.title || d.name, value: [d.lng, d.lat, d.id, d.broad],
      symbolSize: d.id === selId ? 10 : d.id === hovId ? 7 : 3,
      itemStyle: {
        color: BROAD_COLORS[d.broad] || BROAD_COLORS['未分类'],
        borderColor: dk ? '#111620' : '#fff', borderWidth: d.id === selId ? 2.5 : 1,
        shadowBlur: d.id === selId ? 14 : 0,
        opacity: focusBroad && d.broad !== focusBroad ? 0.16 : 0.9,
      },
      label: {
        show: d.id === selId, position: 'right' as const, distance: 8, fontSize: 10,
        color: dk ? '#e8e4df' : '#1a1814', fontWeight: 700,
      },
    }));

    if (mapMode === 'points') c.setOption({ series: [{ data: scatterData as never }] }, false);
  }, [selId, hovId, dk, points, focusBroad, mapMode]);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); safeDispose(chart.current); chart.current = null; };
  }, []);

  function selectBroadGroup(group: string) {
    const members = points.filter((p) => p.broad === group);
    setFocusBroad((prev) => prev === group ? null : group);
    if (!members.length) return;
    selectDialect({
      id: `__map__${group}`,
      name: group,
      title: group,
      lat: 0,
      lng: 0,
      region: "",
      group,
      subgroup: "",
      broad: group as never,
      color: BROAD_COLORS[group] || BROAD_COLORS["未分类"],
      symbol: "circle",
      ydFenqu: "",
      csFenqu: "",
      source: "",
      contributor: "",
      location: "",
      markerColor: BROAD_COLORS[group] || BROAD_COLORS["未分类"],
      groupMembers: members.slice(0, 500),
    });
  }

  const rail = (
    <>
      <RailSection title={lang === 'zh-CN' ? '显示模式' : '顯示模式'}>
        <SegmentedControl
          value={mapMode}
          onChange={setMapMode}
          options={[
            { value: 'points', label: lang === 'zh-CN' ? '点位' : '點位' },
            { value: 'density', label: lang === 'zh-CN' ? '密度' : '密度' },
          ]}
        />
      </RailSection>
      <RailSection title={lang === 'zh-CN' ? '样本概览' : '樣本概覽'}>
        <MetricStrip
          items={[
            { label: lang === 'zh-CN' ? '调查点' : '調查點', value: points.length || '—', tone: 'accent' },
            { label: lang === 'zh-CN' ? '大类' : '大類', value: groupCounts.length || '—' },
          ]}
        />
      </RailSection>
      <RailSection title={lang === 'zh-CN' ? '方言大类' : '方言大類'}>
        <LegendList
          items={groupCounts.slice(0, 12).map(([group, count]) => ({
            key: group,
            label: group,
            value: count,
            color: BROAD_COLORS[group] || BROAD_COLORS['未分类'],
            active: !focusBroad || focusBroad === group,
            onClick: () => selectBroadGroup(group),
          }))}
        />
      </RailSection>
      {focusStats ? (
        <RailSection title={lang === 'zh-CN' ? '高亮大类' : '高亮大類'}>
          <MetricStrip
            items={[
              { label: focusStats.broad, value: focusStats.count, tone: 'accent' },
              { label: lang === 'zh-CN' ? '跨度' : '跨度', value: `${Math.round(focusStats.geoSpanKm)}km` },
            ]}
          />
          <LegendList
            items={focusStats.topProvinces.slice(0, 5).map((province) => ({
              key: province.name,
              label: province.name,
              value: province.count,
              color: 'var(--mineral-green)',
            }))}
          />
        </RailSection>
      ) : null}
    </>
  );

  return (
    <ResearchLayout rail={rail} railKicker="Atlas" railTitle={lang === 'zh-CN' ? '空间覆盖' : '空間覆蓋'}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </ResearchLayout>
  );
}

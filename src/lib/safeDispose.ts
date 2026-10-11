export function safeDispose(chart: any) {
  if (!chart || chart.isDisposed?.()) return;
  const dom = chart.getDom?.();
  if (dom && dom.parentNode) {
    chart.dispose();
  }
}

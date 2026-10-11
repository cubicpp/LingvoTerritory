$f = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "src/lib/guides.ts"
$c = [System.IO.File]::ReadAllText((Resolve-Path $f))

# 1. Merge scatter sections: remove duplicate "密度轮廓与视图模式" and merge into "视图模式与读法"
# The body of "视图模式与读法" (old bubble) should include density/circle info
$oldBubble = "每类方言以一彩色气泡示之。气泡圆心为该类所有方言点MDS坐标之质心所在，泡径正比于该类点数之平方根。泡内散布随机采样之小圆点（最多三十点），以示同类内部空间之离散程度。气泡上方标注大类名称及点数。左侧固定图例栏列出十五大类，每行以圆角矩形色块标注，点击某行可切换该大类气泡之显隐——隐藏后以半透明状态保留。右上角"
$newBubble = "左侧面板设有`u300C点云密度`u300D与`u300C圆形聚合`u300D两种视图模式。每类方言以染色气泡示之——泡径正比于该类点数之平方根，圆心为该类MDS坐标之质心。`u300C点云密度`u300D模式下，散点呈现真实MDS坐标，组别点数足够（`u226524点）时叠加KDE密度轮廓线——外层轮廓勾勒`u300C领土`u300D，内层标记`u300C核心区`u300D，点数不足24的组别不绘轮廓以免误导。`u300C圆形聚合`u300D模式下，方言点均匀排列在代表圆内——适合快速比较规模与位置，但会牺牲原始分布信息。点击大圆点（质心）可查看聚合分析指标。左侧图例可切换显隐。右上角"
$c = $c -replace ([regex]::Escape($oldBubble)), $newBubble

# Remove duplicate "密度轮廓与视图模式" section  
$oldDensitySection = "      {`r`n        heading: `"密度轮廓与视图模式`",`r`n        headingTw: `"密度輪廓與視圖模式`",`r`n        body: `"左侧面板设有"
# Just find and remove the extraneous section - match from `heading: "密度` to the next `},` after bodyTw
$pattern = '(?s)\s+\{\s+heading: "密度轮廓与视图模式".+?\},\s+'
$c = $c -replace $pattern, "`r`n"

# 2. Fix compsearch "如何读图" body - replace old grid description
$oldCompsearch = "顶部搜索框可按部件字符实时筛选，输入后矩形树自动重排仅显示匹配结果。下方以ECharts矩形树图（Treemap）展示全部部件"
$newCompsearch = "顶部搜索框可按部件字符实时筛选，输入后矩形树自动重排仅显示匹配结果。下方以ECharts矩形树图（Treemap）展示全部部件——每一块彩色矩形代表一个部件，矩形的面积正比于包含该部件的汉字总数，面积愈大者部件愈常见。颜色循环区分不同部件，大块部件（如`u300C氵`u300D`u300C口`u300D`u300C木`u300D）以粗体标注部件名与字数，小块部件仅显示部件本身。部件按字频降序排列。点击任一矩形，右侧InfoDrawer滑出该部件涵盖的全部汉字列表。悬停矩形浮现工具提示，显示部件名及精确字数与占比"
$c = $c -replace ([regex]::Escape($oldCompsearch)), $newCompsearch

# 3. Also fix the compsearch heading body (the one I partially fixed)
$oldCompHeading = "顶部搜索框可按部件字符实时筛选（如输入"
$c = $c -replace ([regex]::Escape($oldCompHeading)), "顶部搜索框可按部件字符实时筛选——输入单个汉字部件（如`u300C"

[System.IO.File]::WriteAllText((Resolve-Path $f), $c)
"All guide fixes applied"

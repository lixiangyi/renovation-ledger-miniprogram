const store = require('../../utils/store')
const { fenToYuan } = require('../../utils/money')
const { aggregate, resolveHealth, interleaveLargeAndSmall } = require('../../utils/metrics')
const themeUtil = require('../../utils/theme')

const COLORS = ['#5C6BC0', '#26A69A', '#FFA726', '#EF5350', '#AB47BC', '#42A5F5', '#66BB6A', '#8D6E63']

function shortName(raw) {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (t.length <= 4) return t
  return t.slice(0, 3) + '…'
}

function displayLegend(legend, selectedIndex) {
  if (selectedIndex < 0) return legend
  const selected = legend.find((item) => item.index === selectedIndex)
  if (!selected) return legend
  return [selected].concat(legend.filter((item) => item.index !== selectedIndex))
}

Page({
  data: {
    groupBy: 'category',
    pieMetric: 'projected',
    legend: [],
    displayLegend: [],
    rows: [],
    theme: {},
    totalText: '',
    selectedIndex: -1,
    tipText: '',
    _pieMeta: null,
  },

  onShow() {
    this.refresh()
  },

  setGroupBy(e) {
    this.setData({ groupBy: e.currentTarget.dataset.v, selectedIndex: -1 })
    this.refresh()
  },

  setPieMetric(e) {
    this.setData({ pieMetric: e.currentTarget.dataset.v, selectedIndex: -1 })
    this.refresh()
  },

  refresh() {
    const { state, theme } = themeUtil.applyTheme(this)
    const groups = aggregate(state.items, this.data.groupBy)
    const metricKey = this.data.pieMetric === 'paid' ? 'paid'
      : this.data.pieMetric === 'budget' ? 'budget' : 'projected'
    const total = groups.reduce((s, g) => s + g[metricKey], 0)
    const selectedIndex = this.data.selectedIndex
    const legend = groups.filter((g) => g[metricKey] > 0).map((g, i) => {
      const percent = total > 0 ? (g[metricKey] * 100 / total) : 0
      return {
        key: g.key,
        shortKey: shortName(g.key),
        color: COLORS[i % COLORS.length],
        percent,
        percentText: percent.toFixed(1) + '%',
        amountText: fenToYuan(g[metricKey]),
        value: g[metricKey],
        index: i,
        selected: i === selectedIndex,
        labelMode: 'outside',
      }
    })
    const tipText = '点击扇区或图例可高亮'
    const rows = groups.map((g) => {
      const over = g.projected - g.budget
      const health = resolveHealth(Math.max(0, over), g.budget || 1, state.prefs.mildOverMaxPercent)
      return {
        key: g.key,
        budgetText: fenToYuan(g.budget),
        paidText: fenToYuan(g.paid),
        projectedText: fenToYuan(g.projected),
        overText: over > 0 ? '超 ' + fenToYuan(over) : (over < 0 ? '余 ' + fenToYuan(-over) : '持平'),
        healthClass: !state.prefs.healthColorEnabled ? ''
          : health === 'SEVERE_OVER' ? 'health-severe'
            : health === 'MILD_OVER' ? 'health-mild' : 'health-within',
      }
    })
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};`,
      legend,
      displayLegend: displayLegend(legend, selectedIndex),
      rows,
      totalText: fenToYuan(total),
      tipText,
    })
    wx.nextTick(() => this.drawPie(legend, total, selectedIndex))
  },

  onLegendTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const selectedIndex = this.data.selectedIndex === index ? -1 : index
    this.applySelection(selectedIndex)
  },

  onPieTouch(e) {
    const meta = this.data._pieMeta
    if (!meta || !meta.slices || !meta.slices.length) return
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!touch) return
    const x = touch.x
    const y = touch.y
    const dx = x - meta.cx
    const dy = y - meta.cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < meta.inner || dist > meta.r + 16) {
      this.applySelection(-1)
      return
    }
    let angle = Math.atan2(dy, dx)
    angle -= -Math.PI / 2
    if (angle < 0) angle += Math.PI * 2
    let acc = 0
    let hit = -1
    for (let i = 0; i < meta.slices.length; i++) {
      acc += meta.slices[i].angle
      if (angle <= acc) {
        hit = meta.slices[i].legendIndex
        break
      }
    }
    this.applySelection(hit)
  },

  applySelection(selectedIndex) {
    const legend = (this.data.legend || []).map((item, i) =>
      Object.assign({}, item, { selected: i === selectedIndex }),
    )
    this.setData({ selectedIndex, legend, displayLegend: displayLegend(legend, selectedIndex) })
    const total = legend.reduce((s, l) => s + l.value, 0)
    this.drawPie(legend, total, selectedIndex)
  },

  drawPie(legend, total, selectedIndex) {
    const query = wx.createSelectorQuery()
    query.select('#pie').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const width = res[0].width
      const height = res[0].height
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      const r = Math.min(width, height) * 0.50
      const inner = selectedIndex >= 0 ? r * 0.28 : r * 0.04
      let start = -Math.PI / 2
      const slices = legend.filter((l) => l.value > 0)
      if (!slices.length || total <= 0) {
        ctx.fillStyle = '#ccc'
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        this.setData({ _pieMeta: null })
        return
      }
      const pieSlices = interleaveLargeAndSmall(slices, (s) => s.value)
      const sliceAngles = pieSlices.map((s) => ({
        angle: (s.value / total) * Math.PI * 2,
        color: s.color,
        labelMode: s.labelMode,
        shortKey: s.shortKey,
        percentValue: s.percent,
        percentText: s.percentText,
        legendIndex: s.index,
      }))

      // slices
      sliceAngles.forEach((s) => {
        const selected = s.legendIndex === selectedIndex
        const drawR = selected ? r + 10 : r
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.fillStyle = s.color
        ctx.arc(cx, cy, drawR, start, start + s.angle)
        ctx.closePath()
        ctx.fill()
        if (selected) {
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, cy, drawR, start, start + s.angle)
          ctx.stroke()
        }
        start += s.angle
      })

      // hole
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(cx, cy, inner, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'

      // labels: radial from center, then short horizontal; overlap → longer radial
      start = -Math.PI / 2
      const pad = 6
      const baseRadial = 10
      const radialStep = 8
      const maxRadial = 26
      const maxH = 8
      const minGap = 18
      const candidates = []
      sliceAngles.forEach((s) => {
        const mid = start + s.angle / 2
        const cos = Math.cos(mid)
        const sin = Math.sin(mid)
        const x1 = cx + cos * (r + 2)
        const y1 = cy + sin * (r + 2)
        candidates.push({
          color: s.color,
          cos,
          sin,
          x1,
          y1,
          onRight: cos >= 0,
          label: s.shortKey ? `${s.shortKey} ${s.percentText}` : s.percentText,
          radial: baseRadial,
        })
        start += s.angle
      })
      ctx.font = 'bold 11px sans-serif'
      const resolveSide = (side) => {
        const items = candidates.filter((it) => it.onRight === side)
          .sort((a, b) => (a.y1 + a.sin * a.radial) - (b.y1 + b.sin * b.radial))
        for (let i = 1; i < items.length; i++) {
          const prev = items[i - 1]
          const cur = items[i]
          let tries = 0
          while (tries < 6) {
            const yPrev = prev.y1 + prev.sin * prev.radial
            const yCur = cur.y1 + cur.sin * cur.radial
            if (Math.abs(yCur - yPrev) >= minGap) break
            if (cur.radial >= maxRadial) break
            cur.radial = Math.min(maxRadial, cur.radial + radialStep)
            tries += 1
          }
          if (tries === 0 && i % 2 === 1) {
            cur.radial = Math.min(maxRadial, baseRadial + radialStep)
          }
        }
      }
      resolveSide(true)
      resolveSide(false)
      candidates.forEach((it) => {
        const x2 = it.x1 + it.cos * it.radial
        const y2 = it.y1 + it.sin * it.radial
        const tw = ctx.measureText(it.label).width
        const remaining = it.onRight ? (width - pad - tw - 3 - x2) : (x2 - pad - tw - 3)
        const hLen = Math.max(0, Math.min(maxH, remaining))
        const x3 = it.onRight ? x2 + hLen : x2 - hLen
        ctx.strokeStyle = it.color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(it.x1, it.y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x3, y2)
        ctx.stroke()
        ctx.fillStyle = '#333'
        ctx.textAlign = it.onRight ? 'left' : 'right'
        ctx.textBaseline = 'middle'
        let textX = it.onRight ? x3 + 3 : x3 - 3
        textX = it.onRight
          ? Math.min(textX, width - pad - tw)
          : Math.max(textX, pad + tw)
        ctx.fillText(it.label, textX, y2)
      })

      this.setData({
        _pieMeta: { cx, cy, r, inner, slices: sliceAngles },
      })
    })
  },
})

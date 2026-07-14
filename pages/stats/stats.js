const store = require('../../utils/store')
const { fenToYuan } = require('../../utils/money')
const { aggregate, resolveHealth } = require('../../utils/metrics')
const themeUtil = require('../../utils/theme')

const COLORS = ['#5C6BC0', '#26A69A', '#FFA726', '#EF5350', '#AB47BC', '#42A5F5', '#66BB6A', '#8D6E63']
const LABEL_MIN = 5
const LABEL_INSIDE_MIN = 12

function shortName(raw) {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (t.length <= 4) return t
  return t.slice(0, 3) + '…'
}

function luminance(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

Page({
  data: {
    groupBy: 'category',
    pieMetric: 'projected',
    legend: [],
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
        selected: i === selectedIndex,
        labelMode: percent >= LABEL_INSIDE_MIN ? 'inside'
          : (percent >= LABEL_MIN ? 'outside' : 'none'),
      }
    })
    const hasTiny = legend.some((l) => l.labelMode === 'none')
    const hasOutside = legend.some((l) => l.labelMode === 'outside')
    let tipText = '点击扇区或图例可高亮'
    if (hasTiny || hasOutside) {
      tipText = (hasTiny ? `小于 ${LABEL_MIN}% 未标在图上；` : '')
        + (hasOutside ? '过小扇区的关键字与百分比标在外侧；' : '')
        + '点击可高亮图例'
    }
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
        hit = i
        break
      }
    }
    this.applySelection(hit)
  },

  applySelection(selectedIndex) {
    const legend = (this.data.legend || []).map((item, i) =>
      Object.assign({}, item, { selected: i === selectedIndex }),
    )
    this.setData({ selectedIndex, legend })
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
      const r = Math.min(width, height) * 0.32
      const inner = r * 0.55
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
      const sliceAngles = slices.map((s) => ({
        angle: (s.value / total) * Math.PI * 2,
        color: s.color,
        labelMode: s.labelMode,
        shortKey: s.shortKey,
        percentText: s.percentText,
      }))

      // slices
      sliceAngles.forEach((s, i) => {
        const selected = i === selectedIndex
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

      // labels
      start = -Math.PI / 2
      sliceAngles.forEach((s) => {
        const mid = start + s.angle / 2
        const cos = Math.cos(mid)
        const sin = Math.sin(mid)
        if (s.labelMode === 'inside' && s.angle > 0.22) {
          const tx = cx + cos * (r * 0.7)
          const ty = cy + sin * (r * 0.7)
          ctx.fillStyle = luminance(s.color) > 0.62 ? '#333' : '#fff'
          ctx.font = 'bold 11px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          if (s.shortKey) {
            ctx.fillText(s.shortKey, tx, ty - 7)
            ctx.fillText(s.percentText, tx, ty + 7)
          } else {
            ctx.fillText(s.percentText, tx, ty)
          }
        } else if (s.labelMode === 'outside') {
          const x1 = cx + cos * (r + 2)
          const y1 = cy + sin * (r + 2)
          const x2 = cx + cos * (r + 18)
          const y2 = cy + sin * (r + 18)
          const onRight = cos >= 0
          const x3 = onRight ? x2 + 14 : x2 - 14
          ctx.strokeStyle = s.color
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.lineTo(x3, y2)
          ctx.stroke()
          ctx.fillStyle = '#333'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = onRight ? 'left' : 'right'
          ctx.textBaseline = 'middle'
          const label = s.shortKey ? `${s.shortKey} ${s.percentText}` : s.percentText
          ctx.fillText(label, onRight ? x3 + 3 : x3 - 3, y2)
        }
        start += s.angle
      })

      this.setData({
        _pieMeta: { cx, cy, r, inner, slices: sliceAngles },
      })
    })
  },
})

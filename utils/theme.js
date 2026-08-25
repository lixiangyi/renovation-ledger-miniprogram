const store = require('./store')
const { calculateMetrics, resolveHealth, healthTheme } = require('./metrics')

/** Sync resolve from local store — use for Page data() so first paint is not green DEFAULT. */
function resolveTheme() {
  const state = store.getState()
  const metrics = calculateMetrics(state.items)
  const level = resolveHealth(
    metrics.projectedOverspend,
    metrics.totalBudget,
    state.prefs.mildOverMaxPercent,
  )
  const theme = healthTheme(level, state.prefs.healthColorEnabled)
  return { state, metrics, level, theme }
}

function applyTheme(page) {
  const resolved = resolveTheme()
  const { theme, level, state, metrics } = resolved
  if (page && page.setData) {
    page.setData({ theme, healthLevel: level })
  }
  try {
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: theme.pageBg,
      animation: { duration: 200, timingFunc: 'easeIn' },
    })
  } catch (e) { /* ignore */ }
  return { state, metrics, level, theme }
}

module.exports = {
  applyTheme,
  resolveTheme,
}

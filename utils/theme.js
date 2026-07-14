const store = require('./store')
const { calculateMetrics, resolveHealth, healthTheme } = require('./metrics')

function applyTheme(page) {
  const state = store.getState()
  const metrics = calculateMetrics(state.items)
  const level = resolveHealth(
    metrics.projectedOverspend,
    metrics.totalBudget,
    state.prefs.mildOverMaxPercent,
  )
  const theme = healthTheme(level, state.prefs.healthColorEnabled)
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
}

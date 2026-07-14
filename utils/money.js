/** 金额：分 ↔ 展示 */
function fenToYuan(fen) {
  const n = Number(fen) || 0
  const yuan = n / 100
  if (Number.isInteger(yuan)) return '¥' + yuan.toLocaleString('zh-CN')
  return '¥' + yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function yuanToFen(input) {
  const t = String(input == null ? '' : input).trim()
  if (!t) return null
  const n = Number(t)
  if (Number.isNaN(n)) return null
  return Math.round(n * 100)
}

function formatPercent(rate) {
  return (rate * 100).toFixed(1) + '%'
}

module.exports = {
  fenToYuan,
  yuanToFen,
  formatPercent,
}

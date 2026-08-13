const { fenToYuan } = require('./money')

/**
 * 预计花费相对总预算的百分比，与 Android ProjectedSpendPercent.compute 对齐。
 * @param {number} projectedTotal 预计总花费（分）
 * @param {number} totalBudget 总预算（分）
 * @returns {{ percent: number|null, gap: number, label: string }}
 */
function computeProjectedSpendPercent(projectedTotal, totalBudget) {
  const gap = (projectedTotal || 0) - (totalBudget || 0)
  if (!totalBudget) {
    return { percent: null, gap, label: '—' }
  }
  const percent = Math.round((gap / totalBudget) * 100)
  let label
  if (percent > 0) {
    label = `预计超支 ${percent}%`
  } else if (percent < 0) {
    label = `预计节省 ${Math.abs(percent)}%`
  } else {
    label = '持平'
  }
  return { percent, gap, label }
}

/** 预计花费缺口的金额文案：超支 / 节余 / 与预算持平 */
function projectedGapAmountText(gap) {
  if (gap > 0) return '超支 ' + fenToYuan(gap)
  if (gap < 0) return '节余 ' + fenToYuan(-gap)
  return '与预算持平'
}

module.exports = {
  computeProjectedSpendPercent,
  projectedGapAmountText,
}

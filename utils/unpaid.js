/**
 * 未付合计计算：与 Android UnpaidCalculator 对齐。
 */

/**
 * 未付合计展示口径：
 * - 有合同价：max(0, 合同价 − 已付合计)
 * - 无合同价：兜底用未付付款行合计
 */
function displayUnpaid(contract, paid, unpaidRowsSum) {
  const rowsSum = unpaidRowsSum || 0
  if (contract != null) return Math.max(0, contract - paid)
  return Math.max(0, rowsSum)
}

/** 新增/编辑未付付款时的建议回填金额；无合同价则不建议。 */
function suggestUnpaidAmount(contract, paid) {
  if (contract == null) return 0
  return Math.max(0, contract - paid)
}

module.exports = {
  displayUnpaid,
  suggestUnpaidAmount,
}

/**
 * 支付清单聚合：与 Android PaymentListAggregator 对齐。
 *
 * - **实际支付 (paidSum)**：Σ 已付付款
 * - **预算 (budgetSum)**：Σ 预算
 * - **预计要支付 (projectedSum)**：Σ effectiveCost
 * - **已支付**：有已付的项数 + paidSum
 * - **待支付**：待购买或仍有未付的项；金额 = 待购买用 effectiveCost，付款中用未付行合计
 */
const { PaymentStatus, ItemStatus, deriveStatus, effectiveCost } = require('./model')

const PaymentListGroupBy = { STAGE: 'stage', CATEGORY: 'category', SPACE: 'space' }
const PaymentListLayout = { NESTED: 'nested', FLAT: 'flat' }

function showNewBadge(item) {
  if (item.isNewAddition) return true
  const paid = (item.payments || [])
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((s, p) => s + p.amount, 0)
  return (item.budgetAmount || 0) === 0 && paid > 0
}

function metrics(key, items) {
  let paidSum = 0
  let budgetSum = 0
  let projectedSum = 0
  let paidItemCount = 0
  let pendingItemCount = 0
  let pendingAmountSum = 0
  items.forEach((item) => {
    const payments = item.payments || []
    const paid = payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0)
    const unpaid = payments
      .filter((p) => p.status === PaymentStatus.UNPAID)
      .reduce((s, p) => s + p.amount, 0)
    paidSum += paid
    budgetSum += item.budgetAmount || 0
    projectedSum += effectiveCost(item)
    if (paid > 0) paidItemCount += 1
    const status = deriveStatus(item)
    const isPending = status === ItemStatus.TO_BUY || unpaid > 0
    if (isPending) {
      pendingItemCount += 1
      pendingAmountSum += status === ItemStatus.TO_BUY ? effectiveCost(item) : unpaid
    }
  })
  return {
    key,
    items,
    paidSum,
    budgetSum,
    projectedSum,
    paidItemCount,
    pendingItemCount,
    pendingAmountSum,
  }
}

/** 按阶段 / 分类 / 空间分组；阶段与分类空分组名归入「未分类」，空间归入「未指定」；结果按 key 排序。 */
function group(items, groupBy) {
  const map = {}
  const order = []
  ;(items || []).forEach((item) => {
    if (groupBy === PaymentListGroupBy.SPACE) {
      const key = (item.space || '').trim() || '未指定'
      if (!map[key]) {
        map[key] = []
        order.push(key)
      }
      map[key].push(item)
      return
    }
    let raw
    if (groupBy === PaymentListGroupBy.CATEGORY) {
      const category = (item.category || '').trim()
      raw = category ? item.category : item.stage
    } else {
      raw = item.stage
    }
    const key = (raw || '').trim() ? raw : '未分类'
    if (!map[key]) {
      map[key] = []
      order.push(key)
    }
    map[key].push(item)
  })
  return order
    .map((key) => metrics(key, map[key]))
    .sort((a, b) => {
      if (a.key < b.key) return -1
      if (a.key > b.key) return 1
      return 0
    })
}

/** 筛选 Tab 统计：条数 + effectiveCost 合计。 */
function tabStats(items) {
  const list = items || []
  function stat(pred) {
    const subset = list.filter(pred)
    return {
      count: subset.length,
      amountSum: subset.reduce((s, item) => s + effectiveCost(item), 0),
    }
  }
  return {
    all: {
      count: list.length,
      amountSum: list.reduce((s, item) => s + effectiveCost(item), 0),
    },
    toBuy: stat((item) => deriveStatus(item) === ItemStatus.TO_BUY),
    paying: stat((item) => deriveStatus(item) === ItemStatus.PAYING),
    settled: stat((item) => deriveStatus(item) === ItemStatus.SETTLED),
  }
}

module.exports = {
  PaymentListGroupBy,
  PaymentListLayout,
  showNewBadge,
  group,
  tabStats,
}

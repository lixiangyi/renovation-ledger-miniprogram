const { effectiveCost, deriveStatus, ItemStatus, PaymentStatus, HealthLevel } = require('./model')
const { fenToYuan } = require('./money')

function calculateMetrics(items) {
  let totalBudget = 0
  let paidActual = 0
  let unpaidFinal = 0
  let toBuyAmount = 0

  items.forEach((item) => {
    totalBudget += item.budgetAmount || 0
    const status = deriveStatus(item)
    const payments = item.payments || []
    paidActual += payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0)

    if (status === ItemStatus.TO_BUY) {
      toBuyAmount += effectiveCost(item)
    } else if (status === ItemStatus.PAYING) {
      unpaidFinal += payments
        .filter((p) => p.status === PaymentStatus.UNPAID)
        .reduce((s, p) => s + p.amount, 0)
      // 若有缺口未体现在未付记录里，不在此额外加（对齐 Android：待付看 UNPAID）
    }
  })

  const pendingSpend = unpaidFinal + toBuyAmount
  const currentOverspend = paidActual - totalBudget
  const projectedTotal = items.reduce((s, item) => {
    const status = deriveStatus(item)
    if (status === ItemStatus.SETTLED) {
      return s + (item.payments || [])
        .filter((p) => p.status === PaymentStatus.PAID)
        .reduce((a, p) => a + p.amount, 0)
    }
    return s + effectiveCost(item)
  }, 0)
  // 更贴近 Android：预计总花费 = 各单项 effective 口径混合
  // 简化：已结清用已付合计，其余用 effectiveCost；上面已做
  const projectedOverspend = projectedTotal - totalBudget

  return {
    totalBudget,
    paidActual,
    unpaidFinal,
    toBuyAmount,
    pendingSpend,
    currentOverspend,
    projectedTotal,
    projectedOverspend,
  }
}

function resolveHealth(overspend, totalBudget, mildMaxPercent) {
  if (totalBudget <= 0 || overspend <= 0) return HealthLevel.WITHIN
  const rate = overspend / totalBudget
  const mild = (mildMaxPercent == null ? 15 : mildMaxPercent) / 100
  return rate <= mild ? HealthLevel.MILD_OVER : HealthLevel.SEVERE_OVER
}

function healthTheme(level, enabled) {
  if (!enabled) {
    return {
      pageBg: '#F6FBF4',
      primary: '#2E6B4F',
      primaryContainer: '#B8F1D0',
      tabBg: '#EAEFE8',
      levelClass: '',
    }
  }
  switch (level) {
    case HealthLevel.MILD_OVER:
      return {
        pageBg: '#FFF3E0',
        primary: '#EF6C00',
        primaryContainer: '#FFE0B2',
        tabBg: '#FFE8CC',
        levelClass: 'health-mild',
      }
    case HealthLevel.SEVERE_OVER:
      return {
        pageBg: '#FFEBEE',
        primary: '#C62828',
        primaryContainer: '#FFCDD2',
        tabBg: '#FFE0E3',
        levelClass: 'health-severe',
      }
    default:
      return {
        pageBg: '#E8F5E9',
        primary: '#2E7D32',
        primaryContainer: '#C8E6C9',
        tabBg: '#DCECDC',
        levelClass: 'health-within',
      }
  }
}

function healthLabel(level) {
  switch (level) {
    case HealthLevel.MILD_OVER: return '轻度超支'
    case HealthLevel.SEVERE_OVER: return '重度超支'
    default: return '预算内'
  }
}

/** 超支/节余文案色：不受健康色主题开关影响 */
function hintHealthClass(overspend, level) {
  if (overspend < 0) return 'health-within'
  if (overspend === 0) return 'health-flat'
  if (level === HealthLevel.SEVERE_OVER) return 'health-severe'
  if (level === HealthLevel.MILD_OVER) return 'health-mild'
  return 'health-within'
}

/** 进度超过 100% 时着色 */
function percentHealthClass(percent, level) {
  if (percent <= 100) return ''
  return hintHealthClass(1, level)
}

function aggregate(items, groupBy) {
  const map = {}
  items.forEach((item) => {
    let key = '未分类'
    if (groupBy === 'stage') key = item.stage || '未分类'
    else if (groupBy === 'category') key = item.category || item.stage || '未分类'
    else if (groupBy === 'space') key = item.space || '未指定'
    if (!map[key]) {
      map[key] = { key, budget: 0, paid: 0, projected: 0 }
    }
    map[key].budget += item.budgetAmount || 0
    map[key].paid += (item.payments || [])
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0)
    map[key].projected += effectiveCost(item)
  })
  return Object.values(map).sort((a, b) => b.projected - a.projected)
}

/** 已实付展开：超支 / 节余（付款中未超预算的不算节余） */
function classifyPaidBudgetGaps(items) {
  const overspend = []
  const surplus = []
  items.forEach((item) => {
    const paid = (item.payments || [])
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0)
    if (paid <= 0) return
    const budget = item.budgetAmount || 0
    const gap = paid - budget
    const status = deriveStatus(item)
    const percent = budget > 0 ? Math.round((Math.abs(gap) / budget) * 100) : null
    if (gap > 0) {
      overspend.push(gapRow(item, paid, budget, gap, percent))
    } else if (gap < 0 && status === ItemStatus.SETTLED) {
      surplus.push(gapRow(item, paid, budget, -gap, percent))
    }
  })
  overspend.sort((a, b) => b.amount - a.amount)
  surplus.sort((a, b) => b.amount - a.amount)
  return { overspend, surplus }
}

function gapRow(item, paid, budget, gapAbs, percent) {
  return {
    id: item.id,
    name: item.name,
    amount: gapAbs,
    amountText: fenToYuan(gapAbs),
    budgetAmount: budget,
    budgetText: fenToYuan(budget),
    paidAmount: paid,
    paidText: fenToYuan(paid),
    gapPercent: percent,
    percentText: percent == null ? '—' : percent + '%',
  }
}

module.exports = {
  calculateMetrics,
  resolveHealth,
  healthTheme,
  healthLabel,
  hintHealthClass,
  percentHealthClass,
  aggregate,
  classifyPaidBudgetGaps,
}

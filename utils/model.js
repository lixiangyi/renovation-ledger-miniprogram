const PaymentType = { DEPOSIT: 'DEPOSIT', FULL: 'FULL', FINAL: 'FINAL', OTHER: 'OTHER' }
const PaymentStatus = { PAID: 'PAID', UNPAID: 'UNPAID' }
const ItemStatus = { TO_BUY: 'TO_BUY', PAYING: 'PAYING', SETTLED: 'SETTLED' }
const HealthLevel = { WITHIN: 'WITHIN', MILD_OVER: 'MILD_OVER', SEVERE_OVER: 'SEVERE_OVER' }

function effectiveCost(item) {
  return item.contractAmount != null ? item.contractAmount : item.budgetAmount
}

function deriveStatus(item) {
  const payments = item.payments || []
  if (!payments.length) return ItemStatus.TO_BUY
  const allPaid = payments.every((p) => p.status === PaymentStatus.PAID)
  const paidSum = payments
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((s, p) => s + p.amount, 0)
  const target = effectiveCost(item)
  return allPaid && paidSum >= target ? ItemStatus.SETTLED : ItemStatus.PAYING
}

function statusLabel(status) {
  switch (status) {
    case ItemStatus.TO_BUY: return '待购买'
    case ItemStatus.PAYING: return '付款中'
    case ItemStatus.SETTLED: return '已结清'
    default: return status
  }
}

function paymentTypeLabel(type) {
  switch (type) {
    case PaymentType.DEPOSIT: return '定金'
    case PaymentType.FULL: return '全款'
    case PaymentType.FINAL: return '尾款'
    default: return '其他'
  }
}

function paymentStatusLabel(status) {
  return status === PaymentStatus.PAID ? '已付' : '未付'
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

module.exports = {
  PaymentType,
  PaymentStatus,
  ItemStatus,
  HealthLevel,
  effectiveCost,
  deriveStatus,
  statusLabel,
  paymentTypeLabel,
  paymentStatusLabel,
  uid,
}

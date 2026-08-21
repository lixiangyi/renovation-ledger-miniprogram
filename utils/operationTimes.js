const { deriveStatus, effectiveCost, PaymentStatus, PaymentType, ItemStatus, uid } = require('./model')

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function today(nowMs) {
  const d = new Date(nowMs)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function localDateString(epochMs) {
  return today(epochMs)
}

function formatDateTimeToMinute(epochMs) {
  const d = new Date(epochMs)
  return today(epochMs) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function applyPaymentStatus(current, newStatus, nowMs, todayStr, paidOnDateOverride) {
  const override = String(paidOnDateOverride || '').trim()
  if (newStatus === PaymentStatus.UNPAID) {
    return Object.assign({}, current, {
      status: PaymentStatus.UNPAID,
      paidOnDate: null,
      paidAtEpochMs: null,
    })
  }
  if (current.status === PaymentStatus.PAID) {
    return Object.assign({}, current, {
      status: PaymentStatus.PAID,
      paidOnDate: override || current.paidOnDate || todayStr,
    })
  }
  return Object.assign({}, current, {
    status: PaymentStatus.PAID,
    paidOnDate: override || current.paidOnDate || todayStr,
    paidAtEpochMs: nowMs,
  })
}

function newPaymentTimes(status, nowMs, todayStr, paidOnDateOverride) {
  if (status !== PaymentStatus.PAID) return { paidOnDate: null, paidAtEpochMs: null }
  const override = String(paidOnDateOverride || '').trim()
  return { paidOnDate: override || todayStr, paidAtEpochMs: nowMs }
}

function lastPaid(payments) {
  const paid = (payments || []).filter((p) => p.status === PaymentStatus.PAID)
  if (!paid.length) return null
  return paid.slice().sort((a, b) => {
    const at = (b.paidAtEpochMs || 0) - (a.paidAtEpochMs || 0)
    if (at !== 0) return at
    return String(b.paidOnDate || '').localeCompare(String(a.paidOnDate || ''))
  })[0]
}

function syncSettleFields(item, nowMs, todayStr, forceStamp) {
  const status = deriveStatus(item)
  if (status !== ItemStatus.SETTLED) {
    return Object.assign({}, item, { settledOnDate: null, settledAtEpochMs: null })
  }
  if (forceStamp) {
    return Object.assign({}, item, { settledOnDate: todayStr, settledAtEpochMs: nowMs })
  }
  if (item.settledAtEpochMs == null) {
    const last = lastPaid(item.payments)
    return Object.assign({}, item, {
      settledOnDate: (last && last.paidOnDate) || todayStr,
      settledAtEpochMs: nowMs,
    })
  }
  return item
}

function explicitSettle(item, nowMs, todayStr, nickname) {
  const paidExisting = (item.payments || []).map((p) => {
    if (p.status === PaymentStatus.UNPAID) {
      return applyPaymentStatus(p, PaymentStatus.PAID, nowMs, todayStr)
    }
    return p
  })
  const paidSum = paidExisting
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((s, p) => s + (p.amount || 0), 0)
  const gap = effectiveCost(item) - paidSum
  const withGap = gap > 0
    ? paidExisting.concat([{
      id: uid('pay'),
      budgetItemId: item.id,
      type: PaymentType.OTHER,
      amount: gap,
      status: PaymentStatus.PAID,
      paidAtEpochMs: nowMs,
      paidOnDate: todayStr,
      note: '结清补差',
      createdBy: nickname || '',
    }])
    : paidExisting
  return syncSettleFields(Object.assign({}, item, { payments: withGap }), nowMs, todayStr, true)
}

function backfill(item) {
  const payments = (item.payments || []).map((p) => {
    if (p.status === PaymentStatus.PAID && !p.paidOnDate && p.paidAtEpochMs) {
      return Object.assign({}, p, { paidOnDate: localDateString(p.paidAtEpochMs) })
    }
    return p
  })
  const filled = Object.assign({}, item, { payments })
  if (deriveStatus(filled) !== ItemStatus.SETTLED) return filled
  if (filled.settledOnDate || filled.settledAtEpochMs) return filled
  const last = lastPaid(payments)
  if (!last) return filled
  return Object.assign({}, filled, {
    settledOnDate: last.paidOnDate || (last.paidAtEpochMs ? localDateString(last.paidAtEpochMs) : null),
    settledAtEpochMs: last.paidAtEpochMs || null,
  })
}

module.exports = {
  today,
  localDateString,
  formatDateTimeToMinute,
  applyPaymentStatus,
  newPaymentTimes,
  syncSettleFields,
  explicitSettle,
  backfill,
}

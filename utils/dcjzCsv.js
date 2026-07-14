/**
 * 支持两种 CSV：
 * 1) 旧「装修记账」：记账日期,所属类别,建材名称,金额,备注
 * 2) 本 App 导出：项名称,阶段,分类,预算元,合同元,...（还原预算/合同/付款）
 */

const { PaymentType, PaymentStatus } = require('./model')

function yuanToCents(yuan) {
  return Math.round(Number(yuan) * 100)
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += c
    }
  }
  result.push(current)
  return result
}

function dedupeKey(draft) {
  return String(draft.name || '').trim() + '|' + draft.amountCents + '|' + (draft.recordedDate || '')
}

function findCol(header, keys) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i] || ''
    for (let k = 0; k < keys.length; k++) {
      if (h.indexOf(keys[k]) >= 0) return i
    }
  }
  return -1
}

function isLegacyHeader(header) {
  const col0 = header[0] || ''
  return col0.indexOf('记账日期') >= 0 ||
    (col0.indexOf('日期') >= 0 && findCol(header, ['所属类别', '建材']) >= 0)
}

function isNativeHeader(header) {
  const col0 = header[0] || ''
  return col0.indexOf('项名称') >= 0 ||
    (findCol(header, ['预算元', '预算']) >= 0 && findCol(header, ['阶段']) >= 0)
}

function parsePaymentType(label) {
  const s = String(label || '')
  if (s.indexOf('定金') >= 0) return PaymentType.DEPOSIT
  if (s.indexOf('全款') >= 0) return PaymentType.FULL
  if (s.indexOf('尾款') >= 0) return PaymentType.FINAL
  return PaymentType.OTHER
}

function parsePaymentStatus(label) {
  return String(label || '').indexOf('未付') >= 0 ? PaymentStatus.UNPAID : PaymentStatus.PAID
}

function parseDateEpoch(dateStr) {
  if (!dateStr) return null
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  return Number.isFinite(t) ? t : null
}

function parseLegacy(lines) {
  const drafts = []
  let duplicates = 0
  const seen = Object.create(null)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length < 4) continue
    const date = (cols[0] || '').trim() || null
    const stage = (cols[1] || '').trim()
    if (!stage) continue
    const rawName = (cols[2] || '').trim()
    const name = rawName || stage
    const amountYuan = Number((cols[3] || '').trim())
    if (!Number.isFinite(amountYuan)) continue
    const remark = (cols[4] || '').trim()
    const cents = yuanToCents(amountYuan)
    const draft = {
      name,
      amountCents: cents,
      budgetCents: cents,
      contractCents: cents,
      recordedDate: date,
      stage,
      category: stage,
      remark,
      payments: [],
      selected: true,
      isDuplicate: false,
    }
    const key = dedupeKey(draft)
    if (seen[key]) {
      draft.isDuplicate = true
      draft.selected = false
      duplicates += 1
    } else {
      seen[key] = true
    }
    drafts.push(draft)
  }
  return { drafts, duplicates }
}

function parseNative(lines, header) {
  const nameIdx = Math.max(0, findCol(header, ['项名称']))
  const stageIdx = findCol(header, ['阶段'])
  const categoryIdx = findCol(header, ['分类'])
  const budgetIdx = findCol(header, ['预算元', '预算'])
  const contractIdx = findCol(header, ['合同元', '合同'])
  const payTypeIdx = findCol(header, ['付款类型'])
  const payAmountIdx = findCol(header, ['付款金额'])
  const payStatusIdx = findCol(header, ['付款状态'])
  let dateIdx = header.indexOf('日期')
  if (dateIdx < 0) dateIdx = findCol(header, ['日期'])
  const payeeIdx = findCol(header, ['记账人'])
  const remarkIdx = findCol(header, ['备注'])

  const seen = Object.create(null)
  const order = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length <= nameIdx) continue
    const name = (cols[nameIdx] || '').trim()
    if (!name) continue
    let stage = stageIdx >= 0 ? (cols[stageIdx] || '').trim() : ''
    if (!stage && categoryIdx >= 0) stage = (cols[categoryIdx] || '').trim()
    if (!stage) stage = '未分类'
    const category = categoryIdx >= 0 ? ((cols[categoryIdx] || '').trim() || stage) : stage
    const budgetYuan = budgetIdx >= 0 ? Number((cols[budgetIdx] || '').trim()) : NaN
    const contractYuan = contractIdx >= 0 ? Number((cols[contractIdx] || '').trim()) : NaN
    let budgetCents
    if (Number.isFinite(budgetYuan)) budgetCents = yuanToCents(budgetYuan)
    else if (Number.isFinite(contractYuan)) budgetCents = yuanToCents(contractYuan)
    else continue
    const contractCents = Number.isFinite(contractYuan) ? yuanToCents(contractYuan) : null
    const date = dateIdx >= 0 ? ((cols[dateIdx] || '').trim() || null) : null
    const remark = remarkIdx >= 0 ? (cols[remarkIdx] || '').trim() : ''
    const mergeKey = name + '|' + stage
    let acc = seen[mergeKey]
    if (!acc) {
      acc = {
        name,
        stage,
        category,
        budgetCents,
        contractCents,
        recordedDate: date,
        remark,
        payments: [],
        selected: true,
        isDuplicate: false,
      }
      seen[mergeKey] = acc
      order.push(mergeKey)
    } else {
      acc.budgetCents = budgetCents
      if (contractCents != null) acc.contractCents = contractCents
      if (date) acc.recordedDate = date
      if (remark) acc.remark = remark
      acc.category = category
    }

    const payAmountYuan = payAmountIdx >= 0 ? Number((cols[payAmountIdx] || '').trim()) : NaN
    const payTypeLabel = payTypeIdx >= 0 ? (cols[payTypeIdx] || '').trim() : ''
    if (Number.isFinite(payAmountYuan) && payAmountYuan > 0 && payTypeLabel) {
      const statusLabel = payStatusIdx >= 0 ? (cols[payStatusIdx] || '').trim() : ''
      acc.payments.push({
        type: parsePaymentType(payTypeLabel),
        amountCents: yuanToCents(payAmountYuan),
        status: parsePaymentStatus(statusLabel),
        paidAtEpochMs: parseDateEpoch(date),
        createdBy: payeeIdx >= 0 ? (cols[payeeIdx] || '').trim() : '',
      })
    }
  }

  const drafts = order.map((key) => {
    const acc = seen[key]
    return {
      name: acc.name,
      amountCents: acc.budgetCents,
      budgetCents: acc.budgetCents,
      contractCents: acc.contractCents,
      recordedDate: acc.recordedDate,
      stage: acc.stage,
      category: acc.category,
      remark: acc.remark,
      payments: acc.payments,
      selected: true,
      isDuplicate: false,
    }
  })
  return { drafts, duplicates: 0 }
}

/**
 * @returns {{ drafts: Array, duplicates: number, error?: string }}
 */
function parse(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '')
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length > 0)
  if (!lines.length) {
    return { drafts: [], duplicates: 0, error: '文件为空' }
  }

  const header = parseCsvLine(lines[0]).map((h) => (h || '').trim())
  if (isLegacyHeader(header)) {
    return parseLegacy(lines)
  }
  if (isNativeHeader(header)) {
    return parseNative(lines, header)
  }
  return {
    drafts: [],
    duplicates: 0,
    error: '无法识别的 CSV 表头。请使用本 App「导出 CSV」，或旧装修记账导出（含记账日期）',
  }
}

module.exports = {
  parse,
  yuanToCents,
  parseCsvLine,
}

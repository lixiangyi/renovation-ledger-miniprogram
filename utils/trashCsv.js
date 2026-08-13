/**
 * Autosave v1 CSV — mirrors Android AutosaveCsvCodec for trash round-trip.
 */
const MAGIC = '#renovation_ledger_autosave_v1'
const HEADER =
  'record_type,project_id,project_name,member_names,item_id,item_name,stage,category,space,budget_fen,contract_fen,merchant,recorded_date,remark,is_new_addition,payment_id,payment_type,payment_amount_fen,payment_status,paid_at_epoch_ms,payment_note,created_by'

function escapeCsvField(value) {
  const s = String(value == null ? '' : value)
  if (!/[,\"\n\r]/.test(s)) return s
  return '"' + s.replace(/"/g, '""') + '"'
}

function formatRow(fields) {
  return fields.map(escapeCsvField).join(',')
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
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

function encode(snapshot) {
  const project = snapshot.project
  const items = snapshot.items || []
  const payments = snapshot.payments || []
  const lines = [MAGIC, HEADER]
  lines.push(formatRow([
    'project',
    project.id,
    project.name,
    (project.memberNames || []).join('|'),
  ]))
  items.forEach((item) => {
    lines.push(formatRow([
      'item',
      item.projectId,
      '',
      '',
      item.id,
      item.name,
      item.stage,
      item.category || '',
      item.space || '',
      String(item.budgetAmount || 0),
      item.contractAmount == null ? '' : String(item.contractAmount),
      item.merchant || '',
      item.recordedDate || '',
      item.remark || '',
      item.isNewAddition ? '1' : '0',
    ]))
  })
  payments.forEach((p) => {
    lines.push(formatRow([
      'payment', '', '', '',
      p.budgetItemId,
      '', '', '', '', '', '', '', '', '',
      p.id,
      p.type,
      String(p.amount || 0),
      p.status,
      p.paidAtEpochMs == null ? '' : String(p.paidAtEpochMs),
      p.note || '',
      p.createdBy || '',
    ]))
  })
  return '\uFEFF' + lines.join('\n') + '\n'
}

function decode(csvText) {
  try {
    const text = String(csvText || '').replace(/^\uFEFF/, '')
    const lines = text.split(/\r\n|\n|\r/).map((l) => l.replace(/\s+$/, '')).filter((l) => l)
    if (!lines.length || lines[0] !== MAGIC) return null
    let project = null
    const items = []
    const payments = []
    for (let i = 2; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i])
      const type = cols[0]
      if (type === 'project') {
        const id = (cols[1] || '').trim()
        if (!id) return null
        const members = (cols[3] || '').trim()
          ? (cols[3] || '').split('|').map((m) => m.trim()).filter(Boolean)
          : []
        project = {
          id,
          name: (cols[2] || '').trim(),
          memberNames: members,
        }
      } else if (type === 'item') {
        const projectId = (cols[1] || '').trim()
        const id = (cols[4] || '').trim()
        const stage = (cols[6] || '').trim()
        if (!projectId || !id || !stage) return null
        const budgetFen = parseInt(cols[9], 10)
        if (Number.isNaN(budgetFen)) return null
        const contractRaw = (cols[10] || '').trim()
        const contractFen = contractRaw === '' ? null : parseInt(contractRaw, 10)
        const flag = (cols[14] || '').trim()
        if (flag !== '' && flag !== '0' && flag !== '1') return null
        items.push({
          id,
          projectId,
          name: (cols[5] || '').trim(),
          stage,
          category: (cols[7] || '').trim(),
          space: (cols[8] || '').trim(),
          budgetAmount: budgetFen,
          contractAmount: Number.isNaN(contractFen) ? null : contractFen,
          merchant: (cols[11] || '').trim(),
          recordedDate: (cols[12] || '').trim() || null,
          remark: (cols[13] || '').trim(),
          isNewAddition: flag === '1',
          payments: [],
        })
      } else if (type === 'payment') {
        const budgetItemId = (cols[4] || '').trim()
        const id = (cols[15] || '').trim()
        if (!budgetItemId || !id) return null
        const amount = parseInt(cols[17], 10)
        if (Number.isNaN(amount)) return null
        const paidRaw = (cols[19] || '').trim()
        payments.push({
          id,
          budgetItemId,
          type: (cols[16] || '').trim(),
          amount,
          status: (cols[18] || '').trim(),
          paidAtEpochMs: paidRaw === '' ? null : parseInt(paidRaw, 10),
          note: (cols[20] || '').trim(),
          createdBy: (cols[21] || '').trim(),
        })
      }
    }
    if (!project) return null
    return { project, items, payments }
  } catch (e) {
    return null
  }
}

module.exports = { MAGIC, HEADER, encode, decode }

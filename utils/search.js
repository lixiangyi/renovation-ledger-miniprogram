/** 按名称模糊匹配预算项 + 搜索历史维护（规则与 Android ItemNameSearch 对齐） */

function matchByName(items, query) {
  const q = String(query || '').trim()
  if (!q) return []
  const lower = q.toLowerCase()
  return (items || []).filter((item) => String(item.name || '').toLowerCase().indexOf(lower) >= 0)
}

function pushHistory(existing, query, max) {
  const limit = max || 20
  const q = String(query || '').trim()
  if (!q) return existing || []
  const lowerQ = q.toLowerCase()
  const without = (existing || []).filter((v) => String(v || '').toLowerCase() !== lowerQ)
  return [q].concat(without).slice(0, limit)
}

module.exports = {
  matchByName,
  pushHistory,
}

/** 与 Android LedgerOwnerDisplay 对齐：总览只展示拥有者。 */

function nickname(memberNames, cloudMembers) {
  const remote = Array.isArray(cloudMembers) ? cloudMembers : []
  for (let i = 0; i < remote.length; i++) {
    const m = remote[i]
    if (m && String(m.role || '').toUpperCase() === 'OWNER') {
      const n = String(m.nickname || '').trim()
      if (n) return n
    }
  }
  const local = Array.isArray(memberNames) ? memberNames : []
  for (let i = 0; i < local.length; i++) {
    const n = String(local[i] || '').trim()
    if (n) return n
  }
  return ''
}

function namesOwnerFirst(members) {
  const list = Array.isArray(members) ? members.slice() : []
  list.sort((a, b) => {
    const ao = String((a && a.role) || '').toUpperCase() === 'OWNER' ? 0 : 1
    const bo = String((b && b.role) || '').toUpperCase() === 'OWNER' ? 0 : 1
    return ao - bo
  })
  const names = []
  list.forEach((m) => {
    const n = String((m && m.nickname) || '我').trim() || '我'
    if (n && names.indexOf(n) < 0) names.push(n)
  })
  return names
}

function showEmptyCopy(contentReady, isEmpty) {
  return !!contentReady && !!isEmpty
}

module.exports = {
  nickname,
  namesOwnerFirst,
  showEmptyCopy,
}

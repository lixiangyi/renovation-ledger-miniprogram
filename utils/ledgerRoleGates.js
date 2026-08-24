/** 与 Android LedgerRoleGates 对齐。 */

function canManageInviteAndHealth(role, loggedIn, hasCloudId) {
  if (!hasCloudId) return true
  return String(role || '').toUpperCase() !== 'EDITOR'
}

function showCreateInvite(role, loggedIn, hasCloudId) {
  if (!loggedIn || !hasCloudId) return false
  return String(role || '').toUpperCase() === 'OWNER'
}

function roleOf(cloudLedgerId, summaries) {
  const id = String(cloudLedgerId || '').trim()
  if (!id) return null
  const list = Array.isArray(summaries) ? summaries : []
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) return list[i].role || null
  }
  return null
}

module.exports = {
  canManageInviteAndHealth,
  showCreateInvite,
  roleOf,
}

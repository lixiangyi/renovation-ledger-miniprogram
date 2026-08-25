/**
 * 登录后账本可见性：账号云本按上传时间升序；未绑定本地本标「（本地）」排末尾；他人云本隐藏。
 * 未登录：仅展示未绑定本（已绑定本应在退出时硬删）。
 */
function visible(projects, cloudSummaries, loggedIn) {
  const list = Array.isArray(projects) ? projects : []
  const summaries = Array.isArray(cloudSummaries) ? cloudSummaries : []
  if (!loggedIn) {
    return list.filter((p) => !p || !p.cloudLedgerId).map((p) => ({
      project: p,
      displayName: (p && p.name) || '账本',
      isLocalUnbound: false,
    }))
  }
  const cloudIds = {}
  const createdAt = {}
  summaries.forEach((s) => {
    if (!s || !s.id) return
    cloudIds[s.id] = true
    createdAt[s.id] = s.createdAtEpochMs != null ? s.createdAtEpochMs : null
  })
  const account = list.filter((p) => {
    const cid = p && p.cloudLedgerId
    return cid && cloudIds[cid]
  }).slice().sort((a, b) => {
    const ta = createdAt[a.cloudLedgerId] != null
      ? createdAt[a.cloudLedgerId]
      : (a.cloudLinkedAtEpochMs != null ? a.cloudLinkedAtEpochMs : Number.MAX_SAFE_INTEGER)
    const tb = createdAt[b.cloudLedgerId] != null
      ? createdAt[b.cloudLedgerId]
      : (b.cloudLinkedAtEpochMs != null ? b.cloudLinkedAtEpochMs : Number.MAX_SAFE_INTEGER)
    return ta - tb
  })
  const unbound = list.filter((p) => !p || !p.cloudLedgerId)
  return account.map((p) => ({
    project: p,
    displayName: p.name || '账本',
    isLocalUnbound: false,
  })).concat(unbound.map((p) => ({
    project: p,
    displayName: (p.name || '账本') + '（本地）',
    isLocalUnbound: true,
  })))
}

function firstAccountCloudId(summaries) {
  const list = Array.isArray(summaries) ? summaries.slice() : []
  if (!list.length) return null
  list.sort((a, b) => {
    const ta = a.createdAtEpochMs != null ? a.createdAtEpochMs : Number.MAX_SAFE_INTEGER
    const tb = b.createdAtEpochMs != null ? b.createdAtEpochMs : Number.MAX_SAFE_INTEGER
    return ta - tb
  })
  return list[0].id || null
}

function isAccessible(project, cloudIds, loggedIn) {
  if (!loggedIn) return !(project && project.cloudLedgerId)
  const cid = project && project.cloudLedgerId
  if (!cid) return true
  if (Array.isArray(cloudIds)) {
    return cloudIds.indexOf(cid) >= 0
  }
  return !!(cloudIds && cloudIds[cid])
}

module.exports = {
  visible,
  firstAccountCloudId,
  isAccessible,
}

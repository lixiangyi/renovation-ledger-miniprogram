function shouldClearSessionUi(previousUserId, nextUserId) {
  const prev = (previousUserId || '').trim() || null
  const next = (nextUserId || '').trim() || null
  return prev !== next
}

module.exports = { shouldClearSessionUi }

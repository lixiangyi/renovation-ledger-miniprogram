const DS_KEY = 'dashscope_api_key'
const DEEPSEEK_KEY = 'deepseek_api_key'

function getDashScopeKey() {
  return (wx.getStorageSync(DS_KEY) || '').trim()
}

function setDashScopeKey(v) {
  const t = (v || '').trim()
  if (!t) wx.removeStorageSync(DS_KEY)
  else wx.setStorageSync(DS_KEY, t)
}

function getDeepSeekKey() {
  return (wx.getStorageSync(DEEPSEEK_KEY) || '').trim()
}

function setDeepSeekKey(v) {
  const t = (v || '').trim()
  if (!t) wx.removeStorageSync(DEEPSEEK_KEY)
  else wx.setStorageSync(DEEPSEEK_KEY, t)
}

function maskKey(raw) {
  const s = (raw || '').trim()
  if (s.length <= 8) return s ? '****' : ''
  return s.slice(0, 4) + '****' + s.slice(-4)
}

module.exports = {
  getDashScopeKey,
  setDashScopeKey,
  getDeepSeekKey,
  setDeepSeekKey,
  maskKey,
}

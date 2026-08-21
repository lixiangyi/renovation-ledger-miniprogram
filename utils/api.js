const DEV_URL = 'http://10.35.86.169:8080'
const PROD_URL = 'https://api.renovation-ledger.app'

function isDevelop() {
  try {
    const info = wx.getAccountInfoSync()
    return !!(info && info.miniProgram && info.miniProgram.envVersion === 'develop')
  } catch (e) {
    return false
  }
}

function getEnv() {
  const stored = wx.getStorageSync('cloudEnv')
  if (stored === 'prod' || stored === 'dev') return stored
  return isDevelop() ? 'dev' : 'prod'
}

function urlOf(env) {
  return env === 'prod' ? PROD_URL : DEV_URL
}

function getBaseUrl() {
  const stored = wx.getStorageSync('serverBaseUrl')
  if (stored && String(stored).trim()) {
    return String(stored).trim().replace(/\/$/, '')
  }
  return urlOf(getEnv())
}

function getToken() {
  try {
    const store = require('./store')
    return ((store.getState().prefs || {}).jwt) || ''
  } catch (e) {
    return ''
  }
}

function request(path, { method = 'GET', data, token } = {}) {
  const base = getBaseUrl()
  const auth = token !== undefined ? token : getToken()
  return new Promise((resolve, reject) => {
    wx.request({
      url: base + path,
      method,
      data,
      header: auth ? { Authorization: 'Bearer ' + auth } : {},
      success(res) {
        if (res.statusCode === 401) {
          try {
            require('./store').setPrefs({ jwt: '', cloudUserId: '', phone: '', nickname: '我' })
          } catch (e) { /* ignore */ }
          reject({ code: 401, message: '请重新登录' })
        } else if (res.statusCode === 403) {
          reject({ code: 403, message: '没有这个账本的权限' })
        } else if (res.statusCode === 409) {
          reject({
            code: 409,
            message: '该条已被其他人更新，请查看后再改',
            body: res.data,
          })
        } else if (res.statusCode === 410) {
          reject({ code: 410, message: '邀请已失效' })
        } else if (res.statusCode >= 400) {
          const msg = (res.data && (res.data.message || res.data.error)) || '请求失败'
          reject({ code: res.statusCode, message: msg, body: res.data })
        } else {
          resolve(res.data)
        }
      },
      fail: reject,
    })
  })
}

function setBaseUrl(url) {
  const value = String(url || '').trim()
  if (!value) {
    wx.removeStorageSync('serverBaseUrl')
    return getBaseUrl()
  }
  wx.setStorageSync('serverBaseUrl', value.replace(/\/$/, ''))
  return getBaseUrl()
}

function setEnv(env) {
  const next = env === 'prod' ? 'prod' : 'dev'
  wx.setStorageSync('cloudEnv', next)
  wx.setStorageSync('serverBaseUrl', urlOf(next))
  try {
    require('./store').setPrefs({ jwt: '', cloudUserId: '', phone: '', nickname: '我' })
  } catch (e) { /* ignore */ }
  return next
}

module.exports = {
  request,
  getBaseUrl,
  setBaseUrl,
  getToken,
  isDevelop,
  getEnv,
  setEnv,
  DEV_URL,
  PROD_URL,
}

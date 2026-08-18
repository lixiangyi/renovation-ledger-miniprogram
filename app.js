const store = require('./utils/store')
const api = require('./utils/api')

App({
  onLaunch() {
    try {
      store.ensureInitialized()
    } catch (e) {
      console.error('store init failed', e)
    }
    if (api.isDevelop()) {
      this.bindShake()
    }
  },
  bindShake() {
    let last = 0
    wx.startAccelerometer({ interval: 'ui' })
    wx.onAccelerometerChange((res) => {
      const g = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z)
      if (g < 2.2) return
      const now = Date.now()
      if (now - last < 1500) return
      last = now
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      if (cur && cur.route === 'pages/debug/debug') return
      wx.navigateTo({ url: '/pages/debug/debug' })
    })
  },
  globalData: {
    version: '0.1.0',
  },
})

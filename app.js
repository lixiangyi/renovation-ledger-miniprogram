const store = require('./utils/store')

App({
  onLaunch() {
    try {
      store.ensureInitialized()
    } catch (e) {
      console.error('store init failed', e)
    }
  },
  globalData: {
    version: '0.1.0',
  },
})

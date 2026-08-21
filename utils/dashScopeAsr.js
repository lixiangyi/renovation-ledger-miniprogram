const { getDashScopeKey } = require('./aiKeys')

function parseDashScopeAsrText(body) {
  let root = body
  if (typeof body === 'string') {
    try {
      root = JSON.parse(body)
    } catch (e) {
      return null
    }
  }
  if (!root || typeof root !== 'object') return null

  function fromContent(content) {
    if (typeof content === 'string') {
      const t = content.trim()
      return t || null
    }
    if (Array.isArray(content)) {
      const joined = content
        .map((el) => (el && el.text ? String(el.text).trim() : ''))
        .filter(Boolean)
        .join('')
      return joined || null
    }
    return null
  }

  const choices = root.choices
  if (choices && choices[0] && choices[0].message) {
    const t = fromContent(choices[0].message.content)
    if (t) return t
  }
  const outChoices = root.output && root.output.choices
  if (outChoices && outChoices[0] && outChoices[0].message) {
    return fromContent(outChoices[0].message.content)
  }
  return null
}

function transcribeFile(filePath) {
  const key = getDashScopeKey()
  if (!key) {
    return Promise.reject(new Error('missing_dashscope_key'))
  }
  const fs = wx.getFileSystemManager()
  let b64
  try {
    b64 = fs.readFileSync(filePath, 'base64')
  } catch (e) {
    return Promise.reject(e)
  }
  const dataUri = 'data:audio/mp3;base64,' + b64
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      method: 'POST',
      header: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'qwen3-asr-flash',
        messages: [{
          role: 'user',
          content: [{ type: 'input_audio', input_audio: { data: dataUri } }],
        }],
        asr_options: { language: 'zh', enable_itn: false },
      },
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('asr_http_' + res.statusCode))
          return
        }
        const text = parseDashScopeAsrText(res.data)
        if (!text) reject(new Error('empty_asr'))
        else resolve(text)
      },
      fail: reject,
    })
  })
}

module.exports = {
  parseDashScopeAsrText,
  transcribeFile,
}

const { getDeepSeekKey } = require('./aiKeys')
const store = require('./store')

function extractJsonObject(text) {
  const raw = (text || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1))
      } catch (e2) {
        return null
      }
    }
    return null
  }
}

function parseLedgerIntent(transcript) {
  const key = getDeepSeekKey()
  if (!key) {
    return Promise.resolve({ rawText: transcript })
  }
  const taxonomy = store.getTaxonomy()
  const categories = (taxonomy.categories || []).join('、')
  const stages = (taxonomy.stages || []).join('、')
  const system = [
    '你是装修记账助手。根据用户口述，只返回一个 JSON 对象，不要 markdown。',
    '字段：name(string), category(string), stage(string), amountYuan(number), depositYuan(number), depositPaid(boolean), finalPaymentYuan(number), finalPaid(boolean)',
    '分类优先从这些选：' + categories,
    '阶段优先从这些选：' + stages,
    '金额单位是元。不确定的字段用空字符串或 0 或 false。',
  ].join('\n')

  return new Promise((resolve) => {
    wx.request({
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      header: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: transcript },
        ],
        temperature: 0.2,
      },
      success(res) {
        const content = res.data
          && res.data.choices
          && res.data.choices[0]
          && res.data.choices[0].message
          && res.data.choices[0].message.content
        const parsed = extractJsonObject(content)
        if (!parsed) {
          resolve({ rawText: transcript })
          return
        }
        resolve(Object.assign({ rawText: transcript }, parsed))
      },
      fail() {
        resolve({ rawText: transcript })
      },
    })
  })
}

module.exports = {
  parseLedgerIntent,
  extractJsonObject,
}

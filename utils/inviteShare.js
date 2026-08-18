/** 邀请码分享文案（与 Android InviteShareText 保持一致）。 */
function message(code) {
  var trimmed = String(code || '').trim()
  return (
    '【装修记账】邀请你一起记账\n\n' +
    '我在用「装修记账」管理装修预算与付款，邀请你加入同一个账本一起编辑。\n\n' +
    '邀请码：' + trimmed + '\n\n' +
    '打开 App 或微信小程序「装修记账」→ 我的 → 输入邀请码加入。'
  )
}

/** 支持粘贴纯码，或粘贴整段分享文案后提取邀请码。 */
function extractCode(raw) {
  var text = String(raw || '').trim()
  if (!text) return text
  var m = text.match(/邀请码[：:]\s*([A-Za-z0-9]{6})/)
  if (m && m[1]) return m[1]
  if (/^[A-Za-z0-9]{6}$/.test(text)) return text
  return text
}

module.exports = {
  message: message,
  extractCode: extractCode,
}

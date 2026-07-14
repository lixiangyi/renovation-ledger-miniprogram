/**
 * 导出文件名：账本名_时间.csv；同账本旧文件会被新导出覆盖。
 */

function sanitizeLedgerName(name) {
  const trimmed = String(name || '').trim() || '装修账本'
  return trimmed
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || '装修账本'
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function stampNow(date) {
  const d = date || new Date()
  return ''
    + d.getFullYear()
    + pad2(d.getMonth() + 1)
    + pad2(d.getDate())
    + '_'
    + pad2(d.getHours())
    + pad2(d.getMinutes())
    + pad2(d.getSeconds())
}

function fileName(ledgerName, date) {
  return sanitizeLedgerName(ledgerName) + '_' + stampNow(date) + '.csv'
}

function isSameLedgerExport(fileNameStr, ledgerName) {
  const safe = sanitizeLedgerName(ledgerName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('^' + safe + '_\\d{8}_\\d{6}\\.csv$').test(fileNameStr)
}

/**
 * 写入本地用户目录，删除同账本旧导出，返回文件名与路径。
 */
function writeOverwriting(ledgerName, csvText) {
  const fs = wx.getFileSystemManager()
  const dir = wx.env.USER_DATA_PATH
  let existing = []
  try {
    existing = fs.readdirSync(dir) || []
  } catch (e) {
    existing = []
  }
  existing.forEach((name) => {
    if (isSameLedgerExport(name, ledgerName)) {
      try {
        fs.unlinkSync(dir + '/' + name)
      } catch (e) { /* ignore */ }
    }
  })
  const name = fileName(ledgerName)
  const path = dir + '/' + name
  fs.writeFileSync(path, csvText, 'utf8')
  return { name, path }
}

module.exports = {
  sanitizeLedgerName,
  fileName,
  isSameLedgerExport,
  writeOverwriting,
}

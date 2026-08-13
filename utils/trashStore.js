/**
 * 垃圾箱：{USER_DATA_PATH}/trash/index.json + {projectId}.csv
 */
const DIR_NAME = 'trash'
const INDEX_NAME = 'index.json'

function trashDir() {
  return wx.env.USER_DATA_PATH + '/' + DIR_NAME
}

function ensureDir() {
  const fs = wx.getFileSystemManager()
  const dir = trashDir()
  try {
    fs.accessSync(dir)
  } catch (e) {
    try {
      fs.mkdirSync(dir, true)
    } catch (err) { /* ignore */ }
  }
  return dir
}

function indexPath() {
  return ensureDir() + '/' + INDEX_NAME
}

function csvPath(projectId) {
  return ensureDir() + '/' + projectId + '.csv'
}

function readIndex() {
  const fs = wx.getFileSystemManager()
  try {
    const text = fs.readFileSync(indexPath(), 'utf8')
    const list = JSON.parse(text)
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function writeIndex(entries) {
  const fs = wx.getFileSystemManager()
  const sorted = (entries || []).slice().sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
  fs.writeFileSync(indexPath(), JSON.stringify(sorted), 'utf8')
}

function listEntries() {
  return readIndex().slice().sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
}

function writeTrash(projectId, name, itemCount, csvText, deletedAt) {
  const fs = wx.getFileSystemManager()
  ensureDir()
  fs.writeFileSync(csvPath(projectId), csvText, 'utf8')
  const entry = {
    id: projectId,
    name: name || '',
    deletedAt: deletedAt == null ? Date.now() : deletedAt,
    itemCount: itemCount || 0,
    csvPath: projectId + '.csv',
  }
  const next = readIndex().filter((e) => e.id !== projectId).concat([entry])
  writeIndex(next)
  return entry
}

function readCsv(projectId) {
  const fs = wx.getFileSystemManager()
  try {
    return fs.readFileSync(csvPath(projectId), 'utf8')
  } catch (e) {
    return null
  }
}

function removeEntry(projectId) {
  const fs = wx.getFileSystemManager()
  writeIndex(readIndex().filter((e) => e.id !== projectId))
  try {
    fs.unlinkSync(csvPath(projectId))
  } catch (e) { /* ignore */ }
}

module.exports = {
  listEntries,
  writeTrash,
  readCsv,
  removeEntry,
}

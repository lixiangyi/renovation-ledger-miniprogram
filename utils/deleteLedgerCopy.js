/** 与 Android DeleteLedgerCopy 对齐。 */

function forRole(role, ledgerName, hasCloudId) {
  const name = String(ledgerName || '').trim() || '账本'
  const isEditor = hasCloudId && String(role || '').toUpperCase() === 'EDITOR'
  if (hasCloudId && isEditor) {
    return {
      title: '解绑账本',
      body:
        '将「' + name + '」移入垃圾箱，并退出该账本协作（云端账本仍保留，拥有者不受影响）。' +
        '会先导出备份，之后可从垃圾箱恢复；永久删除前仍可找回。',
      confirm: '解绑',
    }
  }
  if (hasCloudId) {
    return {
      title: '删除账本',
      body:
        '将「' + name + '」移入垃圾箱，并删除云端账本（协作成员将无法再访问）。' +
        '会先导出备份，之后可从垃圾箱恢复；永久删除前仍可找回。',
      confirm: '删除',
    }
  }
  return {
    title: '删除账本',
    body:
      '将「' + name + '」移入垃圾箱。会先导出备份，之后可从垃圾箱恢复；永久删除前仍可找回。',
    confirm: '删除',
  }
}

module.exports = { forRole }

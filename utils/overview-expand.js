/** 总览页展开态（模块级缓存，进出二级页/重建 Page 后仍恢复）。 */
var expandState = {
  paidExpanded: false,
  pendingExpanded: false,
  paidTab: 0,
  pendingTab: 'unpaid',
}

function getExpandState() {
  return {
    paidExpanded: expandState.paidExpanded,
    pendingExpanded: expandState.pendingExpanded,
    paidTab: expandState.paidTab,
    pendingTab: expandState.pendingTab,
  }
}

function setExpandState(partial) {
  expandState = Object.assign({}, expandState, partial || {})
  return getExpandState()
}

module.exports = {
  getExpandState,
  setExpandState,
}

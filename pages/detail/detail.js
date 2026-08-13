const store = require('../../utils/store')
const { fenToYuan, yuanToFen } = require('../../utils/money')
const {
  deriveStatus,
  statusLabel,
  paymentTypeLabel,
  paymentStatusLabel,
  PaymentStatus,
  PaymentType,
  effectiveCost,
  uid,
} = require('../../utils/model')
const { displayUnpaid, suggestUnpaidAmount } = require('../../utils/unpaid')
const themeUtil = require('../../utils/theme')
const {
  indexOfOrZero,
  pickerOptions,
  valueFromPicker,
} = require('../../utils/taxonomy')

const PAY_TYPES = [
  { value: PaymentType.DEPOSIT, label: '定金' },
  { value: PaymentType.FULL, label: '全款' },
  { value: PaymentType.FINAL, label: '尾款' },
  { value: PaymentType.OTHER, label: '其他' },
]
const PAY_STATUS = [
  { value: PaymentStatus.PAID, label: '已付' },
  { value: PaymentStatus.UNPAID, label: '未付' },
]

Page({
  data: {
    id: '',
    item: null,
    view: {},
    theme: {},
    editing: false,
    editingItem: false,
    editPayId: '',
    payTypes: PAY_TYPES,
    payStatusList: PAY_STATUS,
    editTypeIndex: 0,
    editStatusIndex: 0,
    editAmountYuan: '',
    editNote: '',
    stageOptions: [],
    categoryOptions: [],
    spaceOptions: [],
    editName: '',
    editStage: '',
    editCategory: '',
    editSpace: '',
    editStageIndex: 0,
    editCategoryIndex: 0,
    editSpaceIndex: 0,
    editBudgetYuan: '',
    editContractYuan: '',
    editRemark: '',
  },

  onLoad(query) {
    this.setData({ id: query.id || '' })
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const { theme } = themeUtil.applyTheme(this)
    const item = store.getItem(this.data.id)
    if (!item) {
      wx.showToast({ title: '未找到该项', icon: 'none' })
      return
    }
    const st = deriveStatus(item)
    const paid = (item.payments || [])
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0)
    const unpaidRowsSum = (item.payments || [])
      .filter((p) => p.status === PaymentStatus.UNPAID)
      .reduce((s, p) => s + p.amount, 0)
    const unpaidSum = displayUnpaid(item.contractAmount, paid, unpaidRowsSum)
    this.setData({
      item,
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};`,
      view: {
        name: item.name,
        statusText: statusLabel(st),
        stage: item.stage,
        category: item.category || '',
        space: item.space || '',
        budgetText: fenToYuan(item.budgetAmount),
        contractText: item.contractAmount != null ? fenToYuan(item.contractAmount) : '未填',
        effectiveText: fenToYuan(effectiveCost(item)),
        paidText: fenToYuan(paid),
        unpaidText: fenToYuan(unpaidSum),
        remark: item.remark || '无',
        payments: (item.payments || []).map((p) => ({
          id: p.id,
          title: paymentTypeLabel(p.type),
          status: paymentStatusLabel(p.status),
          amountText: fenToYuan(p.amount),
          note: p.note || '',
        })),
      },
    })
  },

  openEditItem() {
    const item = store.getItem(this.data.id)
    if (!item) return
    const taxonomy = store.getTaxonomy()
    const stageOptions = pickerOptions(taxonomy.stages, { current: item.stage })
    const categoryOptions = pickerOptions(taxonomy.categories, {
      allowBlank: true,
      current: item.category || '',
    })
    const spaceOptions = pickerOptions(taxonomy.spaces, {
      allowBlank: true,
      current: item.space || '',
    })
    this.setData({
      editingItem: true,
      stageOptions,
      categoryOptions,
      spaceOptions,
      editName: item.name,
      editStage: item.stage || taxonomy.stages[0] || '',
      editCategory: item.category || '',
      editSpace: item.space || '',
      editStageIndex: indexOfOrZero(stageOptions, item.stage || taxonomy.stages[0] || ''),
      editCategoryIndex: indexOfOrZero(categoryOptions, item.category || '（不填）'),
      editSpaceIndex: indexOfOrZero(spaceOptions, item.space || '（不填）'),
      editBudgetYuan: String((item.budgetAmount || 0) / 100),
      editContractYuan: item.contractAmount != null ? String(item.contractAmount / 100) : '',
      editRemark: item.remark || '',
    })
  },

  closeEditItem() {
    this.setData({ editingItem: false })
  },

  onEditName(e) { this.setData({ editName: e.detail.value }) },
  onEditBudget(e) { this.setData({ editBudgetYuan: e.detail.value }) },
  onEditContract(e) { this.setData({ editContractYuan: e.detail.value }) },
  onEditRemark(e) { this.setData({ editRemark: e.detail.value }) },
  onEditStage(e) {
    const editStageIndex = Number(e.detail.value)
    this.setData({
      editStageIndex,
      editStage: valueFromPicker(this.data.stageOptions, editStageIndex, false),
    })
  },
  onEditCategory(e) {
    const editCategoryIndex = Number(e.detail.value)
    this.setData({
      editCategoryIndex,
      editCategory: valueFromPicker(this.data.categoryOptions, editCategoryIndex, true),
    })
  },
  onEditSpace(e) {
    const editSpaceIndex = Number(e.detail.value)
    this.setData({
      editSpaceIndex,
      editSpace: valueFromPicker(this.data.spaceOptions, editSpaceIndex, true),
    })
  },

  saveItem() {
    const item = store.getItem(this.data.id)
    if (!item) return
    const name = (this.data.editName || '').trim()
    const budget = yuanToFen(this.data.editBudgetYuan)
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    if (budget == null || budget < 0) {
      wx.showToast({ title: '请输入预算金额', icon: 'none' })
      return
    }
    const contract = (this.data.editContractYuan || '').trim()
      ? yuanToFen(this.data.editContractYuan)
      : null
    store.upsertItem(Object.assign({}, item, {
      name,
      stage: this.data.editStage,
      category: this.data.editCategory || '',
      space: this.data.editSpace || '',
      budgetAmount: budget,
      contractAmount: contract,
      remark: (this.data.editRemark || '').trim(),
    }))
    this.setData({ editingItem: false })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.refresh()
  },

  openEditPay(e) {
    const payId = e.currentTarget.dataset.id
    const item = store.getItem(this.data.id)
    const pay = (item.payments || []).find((p) => p.id === payId)
    if (!pay) return
    const editTypeIndex = Math.max(0, PAY_TYPES.findIndex((t) => t.value === pay.type))
    const editStatusIndex = Math.max(0, PAY_STATUS.findIndex((s) => s.value === pay.status))
    this.setData({
      editing: true,
      editPayId: payId,
      editTypeIndex,
      editStatusIndex,
      editAmountYuan: String((pay.amount || 0) / 100),
      editNote: pay.note || '',
    })
  },

  closeEdit() {
    this.setData({ editing: false, editPayId: '' })
  },

  onEditType(e) {
    this.setData({ editTypeIndex: Number(e.detail.value) })
  },

  onEditStatus(e) {
    const editStatusIndex = Number(e.detail.value)
    const status = PAY_STATUS[editStatusIndex].value
    const patch = { editStatusIndex }
    if (status === PaymentStatus.UNPAID && !(this.data.editAmountYuan || '').trim()) {
      const item = store.getItem(this.data.id)
      if (item) {
        const paidSumExcludingCurrent = (item.payments || [])
          .filter((p) => p.id !== this.data.editPayId && p.status === PaymentStatus.PAID)
          .reduce((s, p) => s + p.amount, 0)
        const suggested = suggestUnpaidAmount(item.contractAmount, paidSumExcludingCurrent)
        if (suggested > 0) {
          patch.editAmountYuan = String(suggested / 100)
        }
      }
    }
    this.setData(patch)
  },

  onEditAmount(e) {
    this.setData({ editAmountYuan: e.detail.value })
  },

  onEditNote(e) {
    this.setData({ editNote: e.detail.value })
  },

  savePay() {
    const item = store.getItem(this.data.id)
    if (!item) return
    const amount = yuanToFen(this.data.editAmountYuan)
    if (amount == null || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    const type = PAY_TYPES[this.data.editTypeIndex].value
    const status = PAY_STATUS[this.data.editStatusIndex].value
    const payments = (item.payments || []).map((p) => {
      if (p.id !== this.data.editPayId) return p
      return Object.assign({}, p, {
        type,
        amount,
        status,
        note: (this.data.editNote || '').trim(),
        paidAtEpochMs: status === PaymentStatus.PAID
          ? (p.paidAtEpochMs || Date.now())
          : null,
      })
    })
    store.upsertItem(Object.assign({}, item, { payments }))
    this.setData({ editing: false, editPayId: '' })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.refresh()
  },

  deletePay() {
    wx.showModal({
      title: '删除付款',
      content: '确定删除这条付款记录？',
      success: (res) => {
        if (!res.confirm) return
        const item = store.getItem(this.data.id)
        if (!item) return
        const payments = (item.payments || []).filter((p) => p.id !== this.data.editPayId)
        store.upsertItem(Object.assign({}, item, { payments }))
        this.setData({ editing: false, editPayId: '' })
        wx.showToast({ title: '已删除', icon: 'success' })
        this.refresh()
      },
    })
  },

  addPayment() {
    wx.navigateTo({ url: `/pages/entry/entry?itemId=${this.data.id}` })
  },

  settle() {
    const item = store.getItem(this.data.id)
    if (!item) return
    const state = store.getState()
    const nickname = state.prefs.nickname
    const now = Date.now()
    const payments = (item.payments || []).map((p) => {
      if (p.status === PaymentStatus.UNPAID) {
        return Object.assign({}, p, { status: PaymentStatus.PAID, paidAtEpochMs: now })
      }
      return p
    })
    const paidSum = payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amount, 0)
    const gap = effectiveCost(item) - paidSum
    if (gap > 0) {
      payments.push({
        id: uid('pay'),
        budgetItemId: item.id,
        type: PaymentType.OTHER,
        amount: gap,
        status: PaymentStatus.PAID,
        paidAtEpochMs: now,
        note: '结清补差',
        createdBy: nickname,
      })
    }
    store.upsertItem(Object.assign({}, item, { payments }))
    wx.showToast({ title: '已结清', icon: 'success' })
    this.refresh()
  },

  remove() {
    wx.showModal({
      title: '删除预算项',
      content: '确定删除？付款记录会一并删除。',
      success: (res) => {
        if (res.confirm) {
          store.deleteItem(this.data.id)
          wx.navigateBack()
        }
      },
    })
  },
})

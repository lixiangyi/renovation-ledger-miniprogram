const store = require('../../utils/store')
const { yuanToFen, fenToYuan } = require('../../utils/money')
const {
  uid,
  PaymentType,
  PaymentStatus,
} = require('../../utils/model')
const { suggestUnpaidAmount } = require('../../utils/unpaid')
const themeUtil = require('../../utils/theme')
const {
  indexOfOrZero,
  pickerOptions,
  valueFromPicker,
} = require('../../utils/taxonomy')

Page({
  data: {
    mode: 'item', // item | payment
    itemId: '',
    name: '',
    stage: '',
    category: '',
    space: '',
    stageIndex: 0,
    categoryIndex: 0,
    spaceIndex: 0,
    stageOptions: [],
    categoryOptions: [],
    spaceOptions: [],
    budgetYuan: '',
    contractYuan: '',
    remark: '',
    payTypeIndex: 0,
    payTypes: [
      { value: PaymentType.DEPOSIT, label: '定金' },
      { value: PaymentType.FULL, label: '全款' },
      { value: PaymentType.FINAL, label: '尾款' },
      { value: PaymentType.OTHER, label: '其他' },
    ],
    payAmountYuan: '',
    payPaid: true,
    theme: {},
  },

  onLoad(query) {
    const itemId = query.itemId || ''
    if (itemId) {
      const item = store.getItem(itemId)
      this.setData({
        mode: 'payment',
        itemId,
        name: item ? item.name : '',
      })
      wx.setNavigationBarTitle({ title: '记付款' })
    }
  },

  onShow() {
    themeUtil.applyTheme(this)
    this.loadTaxonomy()
    this.setData({
      cssVars: `--page-bg:${this.data.theme.pageBg || '#E8F5E9'};--primary:${this.data.theme.primary || '#2E7D32'};`,
    })
  },

  loadTaxonomy() {
    const taxonomy = store.getTaxonomy()
    const stageOptions = pickerOptions(taxonomy.stages)
    const categoryOptions = pickerOptions(taxonomy.categories, { allowBlank: true, current: this.data.category })
    const spaceOptions = pickerOptions(taxonomy.spaces, { allowBlank: true, current: this.data.space })
    const stage = this.data.stage || taxonomy.stages[0] || ''
    const category = this.data.category
    const space = this.data.space
    this.setData({
      stageOptions,
      categoryOptions,
      spaceOptions,
      stage,
      stageIndex: indexOfOrZero(stageOptions, stage),
      categoryIndex: indexOfOrZero(categoryOptions, category || '（不填）'),
      spaceIndex: indexOfOrZero(spaceOptions, space || '（不填）'),
    })
  },

  onName(e) { this.setData({ name: e.detail.value }) },
  onBudget(e) { this.setData({ budgetYuan: e.detail.value }) },
  onContract(e) { this.setData({ contractYuan: e.detail.value }) },
  onRemark(e) { this.setData({ remark: e.detail.value }) },
  onPayAmount(e) { this.setData({ payAmountYuan: e.detail.value }) },
  clearField(e) {
    const field = e.currentTarget.dataset.field
    if (field) this.setData({ [field]: '' })
  },
  onStage(e) {
    const stageIndex = Number(e.detail.value)
    this.setData({
      stageIndex,
      stage: valueFromPicker(this.data.stageOptions, stageIndex, false),
    })
  },
  onCategory(e) {
    const categoryIndex = Number(e.detail.value)
    this.setData({
      categoryIndex,
      category: valueFromPicker(this.data.categoryOptions, categoryIndex, true),
    })
  },
  onSpace(e) {
    const spaceIndex = Number(e.detail.value)
    this.setData({
      spaceIndex,
      space: valueFromPicker(this.data.spaceOptions, spaceIndex, true),
    })
  },
  onPayType(e) {
    this.setData({ payTypeIndex: Number(e.detail.value) })
  },
  onPayPaid(e) {
    const payPaid = !!e.detail.value
    const patch = { payPaid }
    if (!payPaid && !(this.data.payAmountYuan || '').trim()) {
      let contractAmount = null
      let paidSum = 0
      if (this.data.mode === 'payment') {
        const item = store.getItem(this.data.itemId)
        if (item) {
          contractAmount = item.contractAmount
          paidSum = (item.payments || [])
            .filter((p) => p.status === PaymentStatus.PAID)
            .reduce((s, p) => s + p.amount, 0)
        }
      } else {
        contractAmount = (this.data.contractYuan || '').trim()
          ? yuanToFen(this.data.contractYuan)
          : null
      }
      const suggested = suggestUnpaidAmount(contractAmount, paidSum)
      if (suggested > 0) {
        patch.payAmountYuan = String(suggested / 100)
      }
    }
    this.setData(patch)
  },

  save() {
    const state = store.getState()
    const nickname = state.prefs.nickname
    if (this.data.mode === 'payment') {
      const item = store.getItem(this.data.itemId)
      if (!item) {
        wx.showToast({ title: '预算项不存在', icon: 'none' })
        return
      }
      const amount = yuanToFen(this.data.payAmountYuan)
      if (amount == null || amount <= 0) {
        wx.showToast({ title: '请输入付款金额', icon: 'none' })
        return
      }
      const type = this.data.payTypes[this.data.payTypeIndex].value
      const payment = {
        id: uid('pay'),
        budgetItemId: item.id,
        type,
        amount,
        status: this.data.payPaid ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        paidAtEpochMs: this.data.payPaid ? Date.now() : null,
        note: '',
        createdBy: nickname,
      }
      const payments = (item.payments || []).concat([payment])
      store.upsertItem(Object.assign({}, item, { payments }))
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }

    const name = (this.data.name || '').trim()
    const budget = yuanToFen(this.data.budgetYuan)
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    if (budget == null || budget < 0) {
      wx.showToast({ title: '请输入预算金额', icon: 'none' })
      return
    }
    const contract = this.data.contractYuan.trim()
      ? yuanToFen(this.data.contractYuan)
      : null
    const item = {
      id: uid('item'),
      projectId: state.project.id,
      name,
      stage: this.data.stage,
      category: this.data.category || '',
      space: this.data.space || '',
      budgetAmount: budget,
      contractAmount: contract,
      merchant: '',
      recordedDate: new Date().toISOString().slice(0, 10),
      remark: (this.data.remark || '').trim(),
      isNewAddition: true,
      payments: [],
    }
    const payAmount = yuanToFen(this.data.payAmountYuan)
    if (payAmount != null && payAmount > 0) {
      item.payments.push({
        id: uid('pay'),
        budgetItemId: item.id,
        type: this.data.payTypes[this.data.payTypeIndex].value,
        amount: payAmount,
        status: this.data.payPaid ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        paidAtEpochMs: this.data.payPaid ? Date.now() : null,
        note: '',
        createdBy: nickname,
      })
    }
    store.upsertItem(item)
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 400)
  },
})

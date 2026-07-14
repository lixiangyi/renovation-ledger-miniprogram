/** 与 Android Taxonomy 默认值保持一致 */
const DEFAULT_STAGES = ['水电', '泥木', '油漆', '硬装', '软装', '主材', '验收', '其他']
const DEFAULT_CATEGORIES = ['家具', '家电', '软装', '硬装', '卫浴', '全屋定制', '全屋智能', '全屋净水', '其他']
const DEFAULT_SPACES = ['全屋', '客厅', '主卧', '次卧', '厨房', '卫生间', '阳台', '玄关', '其他']

const Kind = {
  STAGE: 'stages',
  CATEGORY: 'categories',
  SPACE: 'spaces',
}

const KIND_LABEL = {
  stages: '阶段',
  categories: '分类',
  spaces: '空间',
}

function defaultTaxonomy() {
  return {
    stages: DEFAULT_STAGES.slice(),
    categories: DEFAULT_CATEGORIES.slice(),
    spaces: DEFAULT_SPACES.slice(),
  }
}

function sanitizeList(list, defaults) {
  if (!Array.isArray(list)) return defaults.slice()
  const cleaned = list.map((v) => String(v || '').trim()).filter(Boolean)
  const uniq = Array.from(new Set(cleaned))
  return uniq.length ? uniq : defaults.slice()
}

function normalizeTaxonomy(raw) {
  const src = raw || {}
  return {
    stages: sanitizeList(src.stages, DEFAULT_STAGES),
    categories: sanitizeList(src.categories, DEFAULT_CATEGORIES),
    spaces: sanitizeList(src.spaces, DEFAULT_SPACES),
  }
}

function indexOfOrZero(list, value) {
  const i = (list || []).indexOf(value)
  return i >= 0 ? i : 0
}

function pickerOptions(list, { allowBlank = false, current = '' } = {}) {
  const options = []
  if (allowBlank) options.push('（不填）')
  if (current && list.indexOf(current) < 0 && current !== '（不填）') {
    options.push(current)
  }
  return options.concat(list || [])
}

function valueFromPicker(options, index, allowBlank) {
  const v = options[index]
  if (allowBlank && v === '（不填）') return ''
  return v || ''
}

module.exports = {
  DEFAULT_STAGES,
  DEFAULT_CATEGORIES,
  DEFAULT_SPACES,
  Kind,
  KIND_LABEL,
  defaultTaxonomy,
  normalizeTaxonomy,
  indexOfOrZero,
  pickerOptions,
  valueFromPicker,
}

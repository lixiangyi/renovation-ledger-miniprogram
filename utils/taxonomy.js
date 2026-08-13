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

/** 预置图标（emoji），与 Android 端预置图标语义对齐；key 落库，emoji 只在渲染时查表。 */
const PRESET_ICONS = [
  { key: 'water_drop', emoji: '💧', label: '水电' },
  { key: 'construction', emoji: '🧱', label: '泥木' },
  { key: 'format_paint', emoji: '🎨', label: '油漆' },
  { key: 'chair', emoji: '🪑', label: '家具' },
  { key: 'weekend', emoji: '🛋️', label: '软装' },
  { key: 'kitchen', emoji: '🍳', label: '厨房' },
  { key: 'bathtub', emoji: '🛁', label: '卫浴' },
  { key: 'electric_bolt', emoji: '⚡', label: '电器' },
  { key: 'home', emoji: '🏠', label: '全屋' },
  { key: 'bed', emoji: '🛏️', label: '卧室' },
  { key: 'deck', emoji: '🌇', label: '阳台' },
  { key: 'meeting_room', emoji: '🚪', label: '玄关' },
  { key: 'verified', emoji: '✅', label: '验收' },
  { key: 'local_shipping', emoji: '🚚', label: '主材' },
  { key: 'lightbulb', emoji: '💡', label: '智能' },
  { key: 'category', emoji: '📦', label: '其他' },
]

function defaultTaxonomy() {
  return {
    stages: DEFAULT_STAGES.slice(),
    categories: DEFAULT_CATEGORIES.slice(),
    spaces: DEFAULT_SPACES.slice(),
    icons: { stages: {}, categories: {}, spaces: {} },
  }
}

function sanitizeList(list, defaults) {
  if (!Array.isArray(list)) return defaults.slice()
  const cleaned = list.map((v) => String(v || '').trim()).filter(Boolean)
  const uniq = Array.from(new Set(cleaned))
  return uniq.length ? uniq : defaults.slice()
}

/** 图标 key -> value 存 { iconKey } 或 { iconPath }；只保留仍在 validValues 内的条目。 */
function sanitizeIconMap(map, validValues) {
  const result = {}
  if (!map || typeof map !== 'object') return result
  const valid = validValues || []
  Object.keys(map).forEach((value) => {
    if (valid.indexOf(value) < 0) return
    const entry = map[value]
    if (!entry || typeof entry !== 'object') return
    const iconPath = entry.iconPath ? String(entry.iconPath) : ''
    const iconKey = entry.iconKey ? String(entry.iconKey) : ''
    if (iconPath) {
      result[value] = { iconPath }
    } else if (iconKey) {
      result[value] = { iconKey }
    }
  })
  return result
}

function normalizeTaxonomy(raw) {
  const src = raw || {}
  const stages = sanitizeList(src.stages, DEFAULT_STAGES)
  const categories = sanitizeList(src.categories, DEFAULT_CATEGORIES)
  const spaces = sanitizeList(src.spaces, DEFAULT_SPACES)
  const rawIcons = (src.icons && typeof src.icons === 'object') ? src.icons : {}
  return {
    stages,
    categories,
    spaces,
    icons: {
      stages: sanitizeIconMap(rawIcons.stages, stages),
      categories: sanitizeIconMap(rawIcons.categories, categories),
      spaces: sanitizeIconMap(rawIcons.spaces, spaces),
    },
  }
}

function presetIconEmoji(key) {
  const found = PRESET_ICONS.find((p) => p.key === key)
  return found ? found.emoji : ''
}

/** 取某个标签值的图标展示信息：{ emoji, path }，都为空表示无图标。 */
function iconDisplay(icon) {
  if (!icon) return { emoji: '', path: '' }
  if (icon.iconPath) return { emoji: '', path: icon.iconPath }
  if (icon.iconKey) return { emoji: presetIconEmoji(icon.iconKey), path: '' }
  return { emoji: '', path: '' }
}

/** 从 taxonomy（normalizeTaxonomy 产物）按 kind + value 取图标展示信息。 */
function getIconDisplay(taxonomy, kind, value) {
  const icons = (taxonomy && taxonomy.icons && taxonomy.icons[kind]) || {}
  return iconDisplay(icons[value])
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
  PRESET_ICONS,
  defaultTaxonomy,
  normalizeTaxonomy,
  presetIconEmoji,
  iconDisplay,
  getIconDisplay,
  indexOfOrZero,
  pickerOptions,
  valueFromPicker,
}

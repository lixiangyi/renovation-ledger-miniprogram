# 装修记账 · 微信小程序

对齐 Android 版 `renovation-ledger` 的产品口径（总览指标、三态预算项、健康色、统计分组），本地可运行的 MVP。

## 打开方式

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本目录：`/Users/beike/Projects/renovation-ledger-miniprogram`
3. AppID 可先用测试号 / `touristappid`（见 `project.config.json`）
4. 编译预览即可

## 已实现

| 模块 | 说明 |
|------|------|
| 总览 | 总预算 / 已实付 / 待花费 / 预计花费、执行进度、健康色主题、记一笔 |
| 清单 | 按阶段分组，状态筛选，进详情 |
| 统计 | 分类/阶段/空间聚合，Canvas 饼图（≥5% 扇区标百分比），分组超支色 |
| 我的 | 昵称、项目名、健康色、标签管理、导出 CSV（剪贴板）、**导入旧账本 CSV**、重置示例 |
| 详情 | 付款列表、记付款、标记结清、删除、编辑预算项 |
| 记一笔 | 新建预算项（阶段/分类/空间）/ 给已有项加付款 |
| 待花费 | 待付尾款 / 待购买 两个 Tab |
| 标签管理 | 阶段 / 分类 / 空间 自定义 |
| 导入 | 旧装修记账 CSV：选聊天文件或剪贴板 → 勾选确认 → 待购买项 |

## 产品决策（2026-07-14 全按推荐）

详见 `OPEN_QUESTIONS.md`：本地预览 AppID、CSV 互通、不做语音/OCR/自动备份/邀请/纯总预算模式；UI 跟健康色。

## 技术取舍

- **原生微信小程序**（非 uni-app）
- **本地 `wx.setStorageSync`**；与 Android 暂靠 CSV 互通
- **健康色**跟随预计超支；语音 / OCR / 云同步 / 邀请 → 下一期

## 目录

```
app.js / app.json / app.wxss
utils/   model · metrics · money · store · theme · taxonomy · dcjzCsv
pages/   overview list stats mine detail entry pending taxonomy import
```

## 与 Android 的关系

指标口径对齐 Android。近期通过 **CSV 导出/导入** 搬家；云同步未上。

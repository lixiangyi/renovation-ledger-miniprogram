# 装修记账 · 微信小程序

与 Android 版同一套**装修预算 + 付款追踪**产品：总览数字、三态预算项、健康色、云同步与家人协作口径对齐。

本仓库是 **微信原生小程序**（非 uni-app）。姊妹仓库：

| 端 | 仓库 |
|---|---|
| Android | [renovation-ledger](https://github.com/lixiangyi/renovation-ledger) |
| 云端 API | [renovation-ledger-server](https://github.com/lixiangyi/renovation-ledger-server) |

当前开发分支一般为 `dev-0.1`。

---

## 能做什么

- **总览**：总预算 / 已花费 / 待花费 / 预计花费、健康色、最近记账；标题只显示**拥有者** + 账本名
- **清单**：阶段 / 分类 / 空间分组，状态筛选，进详情改付款
- **统计**：Canvas 饼图（已花费 / 预计 / 预算），分组列表
- **我的**：成员与角色、健康色、标签、CSV 导入导出、垃圾箱、设置
- **个人中心**：昵称、头像、登录 / 退出、邀请码加入账本（先预览再确认）
- **登录**：微信一键登录、手机号验证码
- **多账本**：抽屉切换 / 新建 / 改名 / 删除；登录后只看到当前账号有权限的账本
- **语音记账**：录音转写后确认再入账（需配置百炼 Key）
- **本地优先**：进入页面先渲染本机数据，再后台拉云端，避免先闪空态

未登录时数据存在本机 `wx.setStorageSync`；登录后与云端账本同步。

---

## 核心口径（与 Android 一致）

| 概念 | 说明 |
|------|------|
| 账本 | 一次装修一套账；拥有者可邀请协助者 |
| 预算项三态 | 待购买 → 付款中 → 已结清 |
| 总预算 | 分项预算之和 |
| 已实付 | 已付付款之和 |
| 待花费 | 未付尾款 + 待购买 |
| 预计花费 | 按合同价优先、否则预算推算的买完总花费 |

健康色跟随「预计超支 / 总预算」：绿（内）/ 橙（轻度，默认 15%）/ 红（重度），可在「我的」关闭整页换色。

---

## 打开方式

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本仓库目录
3. AppID 可用测试号 / `touristappid`（见 `project.config.json`）
4. 编译预览

云同步、微信登录需配置合法服务地址与小程序后台能力，后端见 [renovation-ledger-server](https://github.com/lixiangyi/renovation-ledger-server)。调试页可切换服务环境。

---

## 目录

```
app.js / app.json / app.wxss
assets/          图标
pages/           总览 清单 统计 我的 登录 个人中心 详情 录入 …
utils/           store · sync · metrics · 角色 / 可见性 / 邀请
```

---

## 与 Android 的差异

| 能力 | 小程序 | Android |
|------|--------|---------|
| 产品口径（指标、三态、协作角色） | 对齐 | 对齐 |
| UI | 原生 WXML | Jetpack Compose |
| 统计图 | Canvas 饼图 | MPAndroidChart 饼图 + 柱状 |
| 发布渠道 | 微信 | APK / 应用商店 |

---

## License

尚未指定开源协议；默认仅作个人 / 协作项目使用。

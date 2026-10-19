# 发布验收记录

## 最终候选版本

- 包版本：`0.4.5`
- 安装来源：GitHub Release tarball（固定文件名 `product-update-tracker.tgz`）
- 包体积：42,596 bytes
- SHA-256：`0ca2720b1ae5883f6d387f892840dc6485417752dcfc20ee8e727f5e157265c2`
- DSH Desktop：`0.11.0`
- 平台：macOS `26.5.1`，Apple Silicon (`arm64`)

## 已完成

- `pnpm check`：33 项测试通过。
- `pnpm pack`：包中包含 `package.json`、`cordis.patch.yml`、服务端入口、客户端入口、README、LICENSE 和测试。
- 工作台使用 `customFrame: true`，原生会话使用宿主提供的 `conversation` 节点。
- 首次进入由宿主目录选择器选择工作区，不静默创建目录。
- 会话归属由 `desktopWorkbenchOwnership` 校验。
- 月度总览、月份切换、更新色块、日报跳转、目标管理和分析会话浮层已在真实 DSH Desktop 中操作验证。
- 截图来自真实安装版本；公开截图裁掉了显示本机路径的顶部区域。
- 源码和打包文件已检查，未发现 `.env`、凭证、Token、用户追踪数据、数据库或本机绝对路径。
- 已从最终 `0.4.5` tarball 安装并完整重启 DSH Desktop；用户确认工作台入口、日期归档、昨日检查、GitHub Atom/patch 抓取、网页正文比较和日报表达均正常。
- 正式仓库身份下的工作区、会话归属和每天 11:00 自动任务已重新绑定。

## 投稿状态

- 公开仓库：<https://github.com/wisdomqin/product-update-tracker>
- Release：<https://github.com/wisdomqin/product-update-tracker/releases/tag/v0.4.5>
- 公开下载复核：42,596 bytes，SHA-256 与本地候选包一致。
- 市场 PR：<https://github.com/dataelement/awesome-dsh-workbench/pull/32>
- PR 范围：仅新增 `data/workbenches/wisdomqin__product-update-tracker.yml`。
- Catalog CI `validate` 与 `Trusted catalog probe` 均已通过；等待维护者审核合并。

## 不适用或边界

- 未发布 npm 包；市场使用 GitHub Release 安装来源。
- 未验证 Windows、Linux 或 Intel macOS，不声明兼容。
- 卸载后的宿主数据保留由 DSH Desktop 负责；本工作台不会在卸载时删除报告、会话或工作区文件。

## 2026-10-13 本机修订（0.4.7，尚非上述公开 Release）

- 删除 GitHub REST API 回退。Atom 最近 20 条覆盖不足时，使用同仓库公开提交网页分页和 `.patch`；若无法确认完整性，则不发布“无更新”。
- `pnpm check`：35 项测试通过；本机 web profile 已从 0.4.7 tarball 安装，安装文件与包内 11 个文件逐项一致。本机固定名 `product-update-tracker.tgz` 也已更新为 0.4.7（SHA-256 `488199e6ffde4007f187ba1332a80dd46299f35f35cd880de3b0f36bdf52804b`）。安装时曾发现同版本号重包会命中旧缓存，因此以 0.4.7 新版本号完成最终安装校验。
- [历史日报只读核对](history-audit-2026-10-13.md)发现若干当前公开计数与存档快照不一致；**没有自动改写历史日报**。重启后可在原会话中指定 GitHub 对象 ID 和日期逐项补查。
- 本修订未在重启后的 Desktop 界面验收，也未更新远端 GitHub Release 或市场 PR。上面 0.4.5 的历史验收与发布记录保持原样。

## 2026-10-19 本机修订与发布（0.4.8）

- 月度总览中已有日报的日期格支持鼠标悬停与键盘聚焦，一句话展示该日报标题摘要；鼠标离开、失焦、滚动或切换月份时关闭提示。
- GitHub 公开提交页补查上限增加至 24 页，2026-10-12 DeepSeek Harness 当前公开页需 16 页才完成覆盖（151 条提交）；普通网页仍禁止旧日期回溯。
- `POST /api/deepseek-harness-daily/refresh` 支持只对单个 GitHub 追踪对象指定 `reportDate` 补查旧日期，不改变未指定日期的“检查昨日”行为。
- `pnpm check`：38 项测试通过；本机固定名 `product-update-tracker.tgz` 已更新为 0.4.8（SHA-256 `ff4e7f9fa8d1d0e5e520ac386e3094dd0e7fc56de4100e3d7b144f748d5f2b52`）。
- 官方 `plugin --profile web add` 的正常、`--offline`、`--offline --ignore-scripts` 三次尝试均停在 pnpm resolved 7，被宿主 300 秒无进展保护终止；runner 恢复了 generation projections。**经用户同意**，先备份原 0.4.7 目录，再将 0.4.8 包的 11 个文件原子写入已安装目录并逐项校验；没有删除原备份。插件管理器的 profile manifest/lock 仍记录 0.4.7，今后包管理安装可能覆盖这次手动部署，仍需单独修复 pnpm 阻塞。
- 用户自行重启后，服务进程在 15:37 北京时间重建；本机 `/api/deepseek-harness-daily/state` 返回 200。新后端 `reportDate` 接口补查 2026-10-12：DeepSeek Harness 0→151、dsh-desktop 0→1，均为 `public-html+patch`，原日报 ID 保持不变；对比补查前备份，仅这两条日报内容变化，其他日报未改变。dshd 当日已有 3 条，未重复改写；普通网页未回溯。**Hover 的运行中视觉效果因浏览器 provider 不可用尚未实测**，仅代码测试与安装文件校验通过。

## 2026-10-19 公开发布与市场同步

- `main` 已推送至 `ef5a03c`，标注 `v0.4.8`；[公开 Release](https://github.com/wisdomqin/product-update-tracker/releases/tag/v0.4.8) 为非草稿、非预发布、latest，附件 `product-update-tracker.tgz` 为 45,917 bytes，SHA-256 `ff4e7f9fa8d1d0e5e520ac386e3094dd0e7fc56de4100e3d7b144f748d5f2b52`。从 Release 重新下载的字节与本地包一致，`latest/download/product-update-tracker.tgz` 已重定向至 v0.4.8。
- 市场现有条目的同名 latest Release 安装地址无需再提交 YAML PR。手动触发的[市场构建](https://github.com/dataelement/awesome-dsh-workbench/actions/runs/39218974820)首次因市场自身 Node 测试进程反序列化错误失败；原工作流重试成功，产出的 `github-pages` artifact 中该条目为 0.4.8、固定 v0.4.8 URL、45,917 bytes 和上述 SHA-256。GitHub Pages/CDN 切换后重新读取[公开市场索引](https://market.dshdesktop.com/index.json)，确认条目已显示 0.4.8、固定 v0.4.8 下载 URL、45,917 bytes 和相同 SHA-256；至此线上目录已更新。

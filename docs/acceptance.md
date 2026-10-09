# 发布验收记录

## 最终候选版本

- 包版本：`0.4.2`
- 安装来源：GitHub Release tarball（固定文件名 `product-update-tracker.tgz`）
- 包体积：41,294 bytes
- SHA-256：`704f60b12392db43f311d5db1b1b9de71e8b2eeedf51db0fbb70343e2d2999e9`
- DSH Desktop：`0.11.0`
- 平台：macOS `26.5.1`，Apple Silicon (`arm64`)

## 已完成

- `pnpm check`：29 项测试通过。
- `pnpm pack`：包中包含 `package.json`、`cordis.patch.yml`、服务端入口、客户端入口、README、LICENSE 和测试。
- 工作台使用 `customFrame: true`，原生会话使用宿主提供的 `conversation` 节点。
- 首次进入由宿主目录选择器选择工作区，不静默创建目录。
- 会话归属由 `desktopWorkbenchOwnership` 校验。
- 月度总览、月份切换、更新色块、日报跳转、目标管理和分析会话浮层已在真实 DSH Desktop 中操作验证。
- 截图来自真实安装版本；公开截图裁掉了显示本机路径的顶部区域。
- 源码和打包文件已检查，未发现 `.env`、凭证、Token、用户追踪数据、数据库或本机绝对路径。

## 最终发布前待完成

- 从最终 `0.4.2` tarball 安装后完整重启 DSH Desktop。
- 确认正式仓库身份下的工作台入口、工作区选择、会话归属和自动任务重新绑定。
- 复核最终 Release 资产下载、大小和 SHA-256。
- 运行市场仓库 `npm run check` 并查看收录 PR 的实际检查日志。

## 不适用或边界

- 未发布 npm 包；市场使用 GitHub Release 安装来源。
- 未验证 Windows、Linux 或 Intel macOS，不声明兼容。
- 卸载后的宿主数据保留由 DSH Desktop 负责；本工作台不会在卸载时删除报告、会话或工作区文件。

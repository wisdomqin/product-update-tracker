# 2026-10-13 历史日报核对（只读）

核对范围：本机 `deepseek-harness-daily/reports.json` 中 2026-10-07 至 2026-10-12 的 GitHub 日报，与核对时公开仓库提交网页分页中按 `committedDate`、`Asia/Shanghai` 归属的提交计数。未改写本机历史日报。

| 对象 | 日期 | 现存日报提交数 | 当前公开页面可见提交数 | 结果 |
| --- | --- | ---: | ---: | --- |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/commits/master/) | 2026-10-07 | 0 | 85 | 不一致 |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/commits/master/) | 2026-10-08 | 0 | 122 | 不一致 |
| [dsh-desktop](https://github.com/dataelement/dsh-desktop/commits/main/) | 2026-10-08 | 7 | 17 | 不一致 |
| [dshd](https://github.com/anywhere-labs/dsh-desktop/commits/master/) | 2026-10-10 | 缺少 | 21 | 缺日报 |
| [dshd](https://github.com/anywhere-labs/dsh-desktop/commits/master/) | 2026-10-12 | 0 | 3 | 不一致 |

这些是**当前公开仓库视图与存档快照不一致**，并不证明提交在原日报生成时已经推送到目标分支；仓库可能后来合并或推送了提交时间属于旧日期的内容。Atom 最多返回最近 20 条，旧实现覆盖不足时回退 GitHub REST API，现存最后错误为 `dshd` 的 API 403 限流。新实现仅用公开 Atom、提交网页同仓库分页与 `.patch`，覆盖不完整时拒绝发布零更新。

后续：重新启动 DSH Desktop 加载新插件，在该工作台**原会话**中逐项指定 GitHub 追踪对象与日期补查；补查会按对象与日期覆盖原日报（保持其 ID），其他对象和普通网页快照不变。请先人工核对是否确实需要把历史快照更新为当前仓库视图；本次审计未执行该写入。

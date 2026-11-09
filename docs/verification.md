# 当前验证范围

本页对应当前源码。包版本仍为 0.3.0，但源码与历史公开 tarball 内容不同。历史基线、测试数和已修复缺口集中在[归档记录](archive/verification-2026-11-07.md)。

## 离线检查

```bash
npm ci
npm run verify
npm run check:types
npm run release:check
npm run verify:consumer
node evaluation/offline-boundaries.mjs --output .verify/evaluation/offline-boundaries.json
node evaluation/check-conditions.mjs
node evaluation/run-batch.mjs --dry-run
node evaluation/run-timeline.mjs --dry-run
```

`verify` 包括语法、Node 测试和四个合成示例；`verify:consumer` 实际打包并离线安装核心与 DSH Bundle，检查模拟宿主的注册、默认配置、授权、结算和卸载。测试中的模型钩子和 fetch 响应均为脚本化数据，不能代替真实宿主或自然度验证。

本次整理在 Windows / Node 24.19.0 上复核：

| 检查 | 结果 |
| --- | --- |
| `npm run verify` | 104 项测试通过，0 失败；语法与四个合成示例通过 |
| `check:types` / `release:check` | 类型和发布元数据检查通过 |
| `verify:consumer` | 核心/DSH 两包离线安装及模拟宿主检查通过 |
| `offline-boundaries.mjs` | 22 个合成边界情境通过 |
| `check-conditions.mjs` | 40 个脚本化条件/变体运行通过 |
| 单轮 / 时间线 `--dry-run` | 分别组装 54 / 169 个调用计划；外部调用、调用失败、条件失败均为 0 |
| README 示例、本地链接 | 示例可执行；146 个本地路径/锚点检查无缺失 |
| npm 包清单 | 核心 56 文件、DSH 9 文件；核心包不含 reports、凭据或运行状态 |

自动化覆盖局部捕获/去重/淡化、全局来源/权限、预算/取消/来源变更、未决回执、持久化写锁，以及评估输入隔离、想法屏蔽、实际 token 参数记录和失败留痕。通过次数不代表全面无缺陷。

## 已运行真实模型的范围

公开汇总位于[实验结果](../evaluation/results/README.md)，机器记录位于 [recorded-runs.json](../evaluation/results/recorded-runs.json)。这些是合成输入、模拟时钟、固定用户台词下的试跑，没有消息发送。

最新 WorkBuddy DS4.1 批次包含 3 条时间线、15 个条件运行、135 条回复、167 次请求和 249,316 tokens；报告中的调用/条件失败均为 0。此前同类 DS4.1 批次为 245,064 tokens。失败和不完整批次也列入汇总，不能只据成功批次评价稳定性。

实验宿主预设部分桥接材料、添加继续提示和回复想法台账，不能把这套流程归为默认核心行为。两个历史批次均自报 host-v1，但中途改变了原文注入与输出上限；当前 host/runner-v2 的快照、日志与想法校验修复只经离线验证，没有新的 live 结果。

## 尚不能据此声称的结论

- 相对定时提示、RAG、Mem0、Letta 等组件的稳定体验优势或不可替代性。
- 全面事实正确、不会打扰用户、真实用户愿意保留或长期使用。
- 实际 DSH 服务桥接、生产消息回执及长期运行已经通过本套评估。
- 预设桥接的命中代表全局核心能自主进行语义联想；或“想到了旧事”必然改善最终回复。

后续正式研究按[测试计划](evaluation-plan.md)冻结条件、配平材料并进行独立场景/盲评。本仓库记录不接管或延长其他环境中的实验。

## 源码、路径与打包检查

当前接口以 [api.md](api.md)、[read-only-sources.md](read-only-sources.md) 及类型声明为准。`src/` 为产品核心，`evaluation/` 为实验实现，`docs/archive/` 为历史资料。

`evaluation/reports/` 由 Git ignore 和嵌套 npm ignore 排除。原始实验报告不可进入提交；公开只保留经过审查的合成汇总。私有来源、映射和报告在工作树外保存。

GitHub CI 使用 Node 22/24 × Linux/Windows；以具体提交的 Actions 结果为准，本地通过不等于远端已通过。`verify` 摘要中外部调用为零的字段是脚本声明，不是独立网络流量审计。

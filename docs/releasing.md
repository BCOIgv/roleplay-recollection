# 发布清单

## 当前状态

截至 2026-11-04（上海时间）：

- [GitHub v0.3.0](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0) 已发布；标签及 `main` 对应 `c4e7b44db1a208fc4c6dde754415f6813d7a7977`。
- Release 提供核心包、DSH 包及各自的 SHA-256 文件。
- 公共 npm registry 对两个包名均返回 404，不能使用包名安装，也不能仅安装 DSH tarball 后期待 registry 自动提供核心依赖。
- 已发现的代码与产物缺口见 [验证说明](verification.md)。下一次发布前应修复并补足回归。

## 版本与元数据

从干净、已审阅的源码提交准备新版本，不改写已发布的 `v0.3.0` 标签或原产物。

1. 同步核心和 DSH 的 `package.json.version`、`src/policy.mjs` 的 `VERSION`、类型文件版本说明及版本化文档。
2. 同步 DSH 的核心依赖范围。当前 `^0.3.0` 接受兼容的 `0.3.x`；若需要只消费精确版本，应改用精确依赖。
3. 将 `CHANGELOG.md` 的 Unreleased 内容转为新版本记录，写明日期、修复和兼容性影响。
4. 确认 `main`、`exports`、`types`、`files`、Node 要求、许可证与仓库链接均正确。
5. DSH 独立产物必须包含许可证正文，并记录已验证的宿主版本和工具接口。

仓库归属已配置为 `BCOIgv`。`npm run configure -- <owner>` 只替换字面量 `OWNER`；当前仓库没有该占位符。Fork 改名需明确修改两份包元数据、文档链接、徽章与 remote，然后检查差异。

## 验证与打包

在源码仓库根目录运行：

```bash
npm run verify
npm run release:check
npm pack --dry-run
npm pack ./dsh --dry-run
```

当前 `release:check` 检查必要文件、部分元数据、核心/DSH 版本关系和敏感文本。它不检查 changelog 版本、tag、入口目标存在性、实际 tarball、TypeScript 或 DSH 宿主。`prepack` / `prepublishOnly` 也只运行 `verify`；发布负责人须单独执行完整验收。

生成两个包并保存 SHA-256（PowerShell）：

```powershell
New-Item -ItemType Directory -Force dist | Out-Null
npm pack --pack-destination dist
npm pack ./dsh --pack-destination dist
Get-FileHash dist/*.tgz -Algorithm SHA256
```

审核实际文件清单：

- 核心必须包含入口、声明、`src/`、README、LICENSE、CHANGELOG。
- DSH 必须包含入口、`cordis.patch.yml`、locale、图标、README 和 LICENSE。
- 不包含状态文件、凭据、缓存、测试临时文件、历史归档或嵌套 tarball。
- 文档链接需在包内成立，或明确指向仓库网页；社交预览图无需进入运行时包。

在独立空目录建立消费端，同时安装这次生成的两个 tarball。验证核心导入/捕获/查询，DSH 显式及缺省配置、工具注册/卸载、配置 patch、实际宿主工具调用；再使用受支持的 TypeScript 版本编译消费端示例。核心零依赖不要求凭空增加 lockfile；引入开发依赖后应提交 lockfile 并使用 `npm ci`。

## 发布和复核

通过验收后，为已审阅提交创建新版本标签。先发布核心包，再发布 DSH 包；如只发布 GitHub，应在安装说明中提供同时安装本地两个 tarball 的方式。

发布到 npm 时，应发布经过验收的同一 tarball，避免重新打包出不同内容。发布后确认两包版本、核心依赖解析及真实消费端安装；GitHub Release 附上同一批 tarball、SHA-256 和对应 changelog。发布动作本身不替代验收。

开发预览状态应在 Release 正文明确说明；是否勾选 GitHub prerelease、使用 npm `next` 标签，应与对外稳定性承诺一致。版本为 `0.x` 不会自动设置这些发布渠道标志。

如发现问题，发布新的修复版本并说明受影响范围；不要将旧标签移动到新代码。npm 撤回或弃用按[官方当前政策](https://docs.npmjs.com/policies/unpublish)处理，不把固定时限视为无条件撤回许可。

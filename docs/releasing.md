# 发布清单

> 目标：从本地干净仓库推到 GitHub，并可选发布到 npm。
> 当前工作区的 `roleplay-recollection` 已完成 `git init`、初始提交与 `v0.3.0` tag；若沿用这份历史，可从第 4 步开始。
> 当前包名 `roleplay-recollection` 在 2026-11-03 检查时 npm 与 GitHub 均可用；发布前请再复核一次。

## 0. 前置

- Node.js ≥ 22。
- 已安装 Git；建议也安装 GitHub CLI（可选）。
- 已注册 GitHub 账号；如果要发 npm，已登录 `npm login`。
- 确定仓库归属：个人账号或组织。下文用 `<owner>` 表示。

## 1. 配置仓库归属

```powershell
npm run configure -- <owner>
```

该命令会把仓库内所有 `BCOIgv` 占位替换为 `<owner>`，包括：

- `package.json` 的 `repository` / `bugs` / `homepage`；
- README 的 CI 徽章链接；
- 本文档中的示例。

替换后检查：

```powershell
git diff
```

如果不想用脚本，也可以手动替换上述文件中的 `BCOIgv`。

## 2. 发布前检查

```powershell
node --version                 # 应 >= v22
npm run verify                 # 语法 + 56 项测试 + 三个示例
npm run release:check          # 元数据、文件、敏感信息、占位符
npm pack --dry-run             # 查看实际会打进 tarball 的文件
```

`release:check` 应输出 `"ok": true`。它会检查：

- 必填文件齐全（README、LICENSE、CHANGELOG、CONTRIBUTING、SECURITY、CI、docs 等）；
- `package.json` 不是 `private`、许可证为 MIT、`exports` 有 types；
- `src/policy.mjs` 的 `VERSION` 与 `package.json` 一致；
- 没有绝对个人路径、API Key、GitHub Token、私钥、个人用户名；
- `repository` 不再包含 `BCOIgv`。

`npm pack --dry-run` 不应包含 `test/`、`reports/`、`archive/`、`migration/`、`.env`、`memory-state.json`、`*.tgz`。

## 3. 初始化 Git

```powershell
git init -b main
git add .
git status                     # 确认没有 .env / memory-state.json / dist / reports
git -c user.name="<你的名字>" -c user.email="<你的邮箱>" commit -m "chore: initial public release v0.3.0"
git tag -a v0.3.0 -m "AI Roleplay Recollection 0.3.0"
```

> 如果本机已配置 `user.name` / `user.email`，可以省略 `-c` 参数。
> 建议使用 GitHub 的 noreply 邮箱，避免公开私人邮箱。

## 4. 创建 GitHub 仓库

在 GitHub 上新建仓库：

- Owner：`<owner>`
- Repository name：`roleplay-recollection`
- 可见性：Public
- **不要**勾选 README、.gitignore、LICENSE（本地已有）

然后：

```powershell
git remote add origin https://github.com/<owner>/roleplay-recollection.git
git push -u origin main --tags
```

如果使用 SSH：

```powershell
git remote add origin git@github.com:<owner>/roleplay-recollection.git
git push -u origin main --tags
```

## 5. GitHub 仓库设置

- **Description**：`A dependency-free recollection engine for AI roleplay and companion characters: source-backed episodes, time-based fading, cue recall, solitude, and optional later contact.`
- **Topics**：`ai-roleplay`、`roleplay-recollection`、`character-memory`、`companion`、`memory`、`recollection`、`solitude`、`nodejs`
- **Social preview**：上传 `docs/assets/social-preview-recollection.png`（1280×640）
- **Issues**：启用；模板已放在 `.github/ISSUE_TEMPLATE/`
- **Discussions**：可选
- **Pages**：可选；本仓库没有需要托管的站点
- **Security**：启用 Private vulnerability reporting

## 6. 创建 Release

1. GitHub → Releases → Draft a new release；
2. Tag：`v0.3.0`；Target：`main`；
3. Title：`AI Roleplay Recollection 0.3.0`；
4. 说明从 `CHANGELOG.md` 的 `[0.3.0]` 段复制；
5. 附加资产：

```powershell
npm pack
# 生成 roleplay-recollection-0.3.0.tgz
```

把 `roleplay-recollection-0.3.0.tgz` 上传到 Release；
6. 发布为 latest。

## 7. 可选：发布到 npm

```powershell
npm login
npm publish --access public
npm view roleplay-recollection version
```

说明：

- `prepublishOnly` 会再跑一次 `npm run verify`；
- 如果包名已被占用，改 `package.json` 的 `name`，并同步 README/文档；
- 首次发布后，npm 页面会自动读取 README；
- 不建议在 72 小时后 `npm unpublish`；优先用 `npm deprecate` 标记版本。

### DSH 子包 `roleplay-recollection-dsh`

核心包发布后，再发布 DSH Bundle：

```powershell
cd dsh
npm install
npm pack --dry-run
npm publish --access public
npm view roleplay-recollection-dsh version
```

说明：

- `dsh/package.json` 依赖 `roleplay-recollection@^0.3.0`，所以必须先发核心包；
- 本地开发时可在 `dsh/` 下先安装核心 tarball：`npm install ..\dist\roleplay-recollection-0.3.0.tgz --no-save`；
- 发布后确认 tarball 包含 `index.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`；
- DSH 插件管理器安装 `roleplay-recollection-dsh` 后即可使用 `roleplay_recollection_*` 工具。

## 8. 发布后验证

在一个空目录安装 tarball 并跑最小导入：

```powershell
mkdir smoke-test
cd smoke-test
npm init -y
npm install ..\roleplay-recollection-0.3.0.tgz
node -e "import('roleplay-recollection').then(m => console.log(m.VERSION, typeof m.CompanionMemory))"
```

应输出类似：

```text
0.3.0 function
```

再确认：

- GitHub Actions 的 CI 为绿色；
- README 首屏 banner、徽章、Mermaid 图正常渲染；
- Release 资产可下载；
- `npm view roleplay-recollection` 的 license/repository 正确。

## 9. 回滚

- **GitHub**：删除 Release 与 tag，或 revert 提交后重新打 tag。
- **npm**：`npm deprecate roleplay-recollection@0.3.0 "reason"`；72 小时内确需撤回才 `npm unpublish roleplay-recollection@0.3.0`。
- **本地**：`archive/2026-11-03-prepublic-0.3.0/` 保存了发布前完整快照（含哈希清单），可用于对照恢复。

## 10. 发布检查表

- [ ] 已运行 `npm run configure -- <owner>`
- [ ] `npm run verify` 通过（56 项）
- [ ] `npm run release:check` 输出 `ok: true`
- [ ] `npm pack --dry-run` 文件列表干净
- [ ] `git status` 无 `.env`、`memory-state.json`、`dist/`、`reports/`
- [ ] 已创建 `main` 分支与 `v0.3.0` tag
- [ ] GitHub 仓库为 Public，描述/topics/social preview 已设置
- [ ] Release 已附加 tarball
- [ ] （可选）npm 发布成功并用 tarball 做过安装冒烟
- [ ] CI 绿色

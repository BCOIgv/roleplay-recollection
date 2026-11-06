# 全局记忆只读接入与 RP 运行

本页描述当前源码的未发布增强。公开 0.3.0 tarball 不包含这些新增接口。运行环境为 Node.js ≥ 22.16；SQLite 使用 Node 内置模块，没有新增运行时第三方依赖。

## 数据流

原生 v2 / JSON / JSONL / SQLite → 只读读取器 → 全局检索 → 角色与受众过滤 → 回想、独处和候选。映射、预算、私人想法及发送账本只保存到本插件自己的目录。

`GlobalRecollection` 的标准检索范围是 `admin-global`。原 scope、storyId、truth 保留在每条材料上，真实陈述不会被改成剧情事实。旧 `CompanionMemory` 保留原有局部经历接口；使用全局模式无需把全部外部资料塞进它的 episodes，也不受它的 200 条经历上限约束。

## 初始化与配置

```js
import {initializeMemorySources, GlobalMemoryLibrary, GlobalRecollection} from 'roleplay-recollection';

const setup = await initializeMemorySources({
  sources: [{id: 'notes', file: './exports/notes.json', format: 'auto',
    rp: {enabled: true, textField: 'summary', detail: 'impression'}}],
  configDirectory: './recollection-runtime',
  // model: hostSetupModel, // 可选；异构 schema 不明确时调用
});
```

来源路径必须来自宿主登记，不接受模型扩大路径范围。source 目录与运行目录必须互不包含。模型仅收到结构描述，不发送记忆正文或凭据；模型钩子返回 `{value: 映射JSON}`。允许模型建议 format、collection、fields、timeUnit、statusMap、truthMap；文件位置、RP 权限等由宿主决定。

已知 native-v2、唯一集合和明确的 id/text 字段会直接识别；歧义集合可交给 setup model。数字时间不根据大小猜单位，缺失语义保留 unknown/null。整个来源试读成功后保存 `memory-sources.json`，包含 schema 指纹。重新初始化会复用有效映射；结构改变时重新探测。运行期间发现变化则该来源报失败，宿主可再次调用初始化，随后 `library.replaceSource(config)` 激活配置。不存在、不支持或有歧义的来源不会被伪造为空库。

`setup.results` 分别标记 active/pending/failed。active 表示格式可读取，不保证每条记录都有足够语义供 RP 使用。generic 来源只有 `rp.enabled:true` 且记录状态映射为 active 才参与 RP；没有状态字段时，宿主若确知该导出全为有效记录，可显式提供 `statusMap: {undefined: 'active'}`。

## 支持格式与约束

- `native-v2`：直接解析文件，不构造有写副作用的 CompanionMemory。RP 尊重暂停、撤回、失效、休眠、细节淡化。自定义淡化阈值需通过 nativePolicy 提供。
- `json`：根数组，或 collection 指定的根级数组字段。
- `jsonl`：每行一个对象。损坏行导致该来源失败，不静默丢弃。
- `sqlite`：collection 指定真实普通表，fields 映射实际列。固定 SELECT，不运行任意 SQL，不加载扩展，不迁移、不建索引；不执行视图、虚拟表或计算列。

通用映射至少提供 id/text；可提供 scope/time/truth/status/storyId。字段路径是字面字段名，不是代码或 JSONPath。时间使用 seconds、milliseconds 或带时区的 iso；枚举可通过 statusMap/truthMap 显式转换。

SQLite 使用只读连接、query_only 和短事务。WAL 库必须已具备可读的 -wal/-shm；不满足时拒绝，不创建辅助文件来修复。读取包含已提交但未合并到主库的 WAL 数据。不要仅复制活跃主库作为完整导出；被冻结的 SQLite 导出应由来源维护者使用一致备份生成。此实现不使用 immutable 绕过活跃库锁。

每次读取有界：默认 8 MiB，可配置至 64 MiB；最多 100000 条。超限报错，不声称完成。SQLite 的正文总量另受该字节限额约束。当前采用完整有界快照而非大型库的流式索引；需要更大规模时应登记分片导出或另写经过验证的适配器，不取消限额。

## 全局查询与权限

```js
const library = new GlobalMemoryLibrary({
  sources: setup.sources,
  unavailableSources: setup.results.filter(r => r.status !== 'active'),
  authorize: hostAuthorize,
});
const page = await library.query({query: '雨天', context: trustedAccess, limit: 20});
```

`hostAuthorize` 是可信宿主函数，接收 `{context, purpose, sourceId, material?}`。先授权来源，后逐条授权材料。必须明确返回 true。不要把聊天文本中的 admin/scope 声明当身份。

- `purpose:'admin'`：管理视图，可查看仍允许保留的历史内容，显示其状态。
- `purpose:'rp'`：仅返回允许用于 RP 的当前材料。来源授权和条目授权应包含当前受众规则，过滤发生在模型输入前。
- `contextKey(access)`：宿主提供的持久身份与受众键；不同受众不能复用一个键。

结果保留 sourceScope/storyId/truth/ref/revision，返回每个来源的成功、拒绝或失败。`sourceCoverage` 仅表示登记来源读取情况；`matched/truncated/nextCursor` 表示本次匹配和分页。cursor 由库签名，来源或权限变化会使其失效，调用方须重新开始。cursor 不能跨库实例或重启复用。

底层查询目前是文字包含匹配；全局范围不等于语义搜索。不同来源分别有一致读取版本，不承诺跨库共同时间点。

## RP 回想、独处与结算

```js
const runtime = new GlobalRecollection({
  characterId: 'character-a', mode: 'roleplay', storyId: 'story-a',
  stateDir: './recollection-runtime',
}, {
  library, contextKey: hostContextKey,
  reflect: hostReflect, wander: hostWander,
});
const result = await runtime.recollect({
  mode: 'roleplay', storyId: 'story-a', trigger: 'cue',
  cue: '雨天', opportunityId: 'message-123', allowExpression: true,
}, {access: trustedAccess});
```

`visible`、`privateThoughts`、`recollect`、`solitude`、`takeExpression` 均为异步方法；`status/pause/settleExpression` 为同步方法。调用时将身份作为 options.access 提供；模型输入不包含该凭据。

- 线索回想与独处共享每日预算；工作、等待回复、暂停会阻止可选回想。
- 独处按持久化机会、空闲时间和上海活动时间窗运行，最多配置步数，允许静默结束；需要宿主触发，不创建后台守护。
- 模型输出必须引用实际材料及原文子串；这验证引用存在，不保证整句话的语义完全受证据支持。
- 每次读取、查看想法、生成结果提交和取用候选都会重新校验来源版本和权限。`refresh({access})` 可供宿主额外主动清点。
- 派生内容绑定整个模型输入材料集合及受众键，避免模型利用其他输入信息后只引用其中一条绕过权限。
- 来源变化会清除不再有效的想法和候选文本；taken/unknown 只保留完成结算所需的最少账本信息。
- `takeExpression` 只取用、不发送；实际发送后用 `settleExpression` 提交 sent/used_in_reply/not_sent/unknown 和真实回执。unknown 阻止新的取用，成功回执更新冷却。
- 程序关闭时取消正在运行的模型调用。未决投递跨重启保留，不能在重启后自动重发。

失效清理由访问或显式 refresh 触发，不提供无条件即时后台删除。取用后到平台发送之间仍需宿主协调；插件无法撤回已经交给平台的网络请求。

## DSH 接入

配置 sources 或宿主提供 `ctx.recollection.listMemorySources()` 时启用全局模式。没有来源配置时，保留旧局部模式。

可信宿主服务 `ctx.recollection` 必须提供：

| 服务 | 作用 |
| --- | --- |
| listMemorySources()（可选） | 安装/启动时返回已授权来源；替代手填 sources |
| resolveAccess(exec) | 从宿主执行上下文验证调用者、受众 |
| authorize(request) | 检查管理员/RP/来源/条目权限；sourceId:null 用于工具入口权限 |
| contextKey(access) | 稳定的主体与受众键 |
| setupModel（可选） | 初始化映射模型，单独统计调用次数 |
| reflect / wander（可选） | 实际模型调用，处理 request.signal 并返回解析后的 value |

全局模式注册 status、global_search、visible、recollect、solitude、private_thoughts、take_expression、settle_expression、pause 共 9 个工具。来源修改继续由原记忆插件负责。宿主缺少可信权限服务时明确报错，不降级成默认管理员。

这是公开的宿主服务契约；真实 DSH 版本的身份和模型服务需由宿主提供桥接。已通过模拟宿主及独立安装包测试，不宣称已在用户的生产 DSH 上运行。

## 验证与运行权限

```bash
npm ci
npm run verify
npm run check:types
npm run release:check
npm run verify:consumer
```

Windows 可运行 `powershell -File scripts/verify-source-acl.ps1`。该脚本只对新建合成来源设置临时拒写 ACL，再恢复权限。库没有来源写路径，但同进程 JavaScript 不能代替系统权限隔离；生产应限制读取主体的写权限。

持久化写锁现在以 guard 串行化锁的建立/回收，未知空锁不会被抢，释放时核对文件身份。若进程在持有 guard 时崩溃，保守停止并要求运维确认无存活写入者后清理 guard；不猜测超时后夺锁。不同版本进程不应混写同一状态目录。

旧状态中已经撤回且没有稳定来源 ID 的墓碑无法凭空恢复来源身份；新增记录会保留来源身份哈希。升级不会修改外部来源文件。

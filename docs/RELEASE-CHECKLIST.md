# 纸航发布检查

更新：2026-10-08，候选版本 preview.46。用户已确认名称「纸航 Paperflight」，并要求核对无问题后公开 GitHub 和注册市场；不再以“没有公开授权”为阻碍。下列状态表示证据是否齐全，不将命名、构建通过当作发布验收完成。

| 项目 | 当前证据与边界 |
| --- | --- |
| 对应源码与许可入口 | 插件内 source/ 与同版下载 tgz；设置页提供本机许可/隐私/源码。每次构建后 verify:package 核对实际散列 |
| 素材 | 已移除旧头像、VRM、DSH ico 和未使用 react.svg；保留字体、Streamline 23 个图标及 PDF.js 声明 |
| 主题来源 | 已追溯 SengokuCola 的 MaiBotOneKey 首次主题提交、次日 MaiBot Dashboard 移植提交；详见 DESIGN-ORIGIN.md |
| 依赖许可 | 原 13 个顶层文本缺项已有补充；victory-vendor 子目录许可证也保留。react-remove-scroll-bar 2.3.8 的精确发布提交不可用，上游当前版本为 2.3.7，文本来源对应问题仍需核实 |
| 隐私 | PRIVACY.md 已覆盖共享浏览器登录态、截图/输入、终端输出传递、宿主日志与删除路径；preview.42–44 变更后的完整动态网络验证未完成 |
| 回归 | preview.44 曾通过 89 项回归；preview.45 为收起条位置调整。本次结果以候选测试与打包报告为准，不继承未执行的宿主验收 |
| 正式环境 UI | 之前隔离测试页可验收，Codex 浏览器访问正式本机端口仍遇客户端拦截；API 成功不能替代完整正式 UI 验收 |
| 另一设备 | 用户此前反馈大部分功能可用及中断/工具等问题；后续版本已有修复，但最新候选的干净安装、升级、卸载和长会话组合尚无同版完整记录 |
| 市场安装 | 已确认本机安装的是 dsh-market/dsh-market 的 dshmarket，目录源是 awesome-dsh-plugin。开发仓库根为源码工程，plugin/ 无生成的 payload；按该目录规则使用 plugin/ 子包条目，并以 tarball 字段指向 GitHub Release 的完整预构建 tgz。需验证真实下载与安装 |
| 桌面版 | 官方已发布 Harness 桌面端；纸航尚未实测，不标兼容 |
| 发布操作 | 先生成候选与可审核来源证据；待办未清零前未改变 GitHub 可见性、未添加市场收录 topic、未宣称上架 |

市场规则来源：[awesome-dsh-plugin 贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)，该地址就是本机市场「申请收录插件」链接。提交 PR 添加一个 data/plugins/<owner>__<repo>--plugin.yml 条目，含子目录 URL、名称、分类、双语说明及固定 release tag 的 tarball 链接；添加 dsh-plugin topic。是否收录取决于 CI 和维护者审核，不能把提交 PR 写成已上架。不需要为了收录额外发布 npm。

调研中也阅读了 bradeGithub/DSH-Plugins-Marketplace 的 STANDARD，但那是另一个市场实现，它的“两小时 topic 扫描”流程不适用于本机 dshmarket，不作为本项目注册依据。

公开前审查仓库完整历史和旧 Release 素材，不能只审查最新目录就把历史私有仓库整体公开。上传限白名单源码、构建产物和许可资料，排除会话、个人路径、账号、运行配置和私人验收截图。

release:check 会对非 PASS 项返回非零，保留此行为。AGPL 接收者权利不因私有测试状态缩减，改名不移除上游版权和源码提供义务。

## 2026-10-09 公开预览与稳定发行分开验收

preview.47 已关闭滚动条依赖来源缺口。公开源码与实验性预览包不冒充稳定发行或完整安全审计；上表“待办未清零前不公开”的旧表述由此修正：稳定发行仍要求完整验收，公开预览保留明确未测项。旧私有仓库保留；独立公开仓库 dsh-paperflight 只导入当前白名单源码，避免历史测试包与当前品牌混淆。市场 PR 在公开下载与安装验证后提交；新仓库须满足目录的一天创建时长要求。

# 纸航 Paperflight for DSH

**0.1.0-preview.47 · 2026-10-09 · 公开预览版（实验性）**

纸面纹理、彩色航线与未来复古面板，为 DeepSeek Harness 提供另一种 Web 工作界面。基于 MaiBot Dashboard 1.7.3 修改，按 AGPL-3.0-only 提供，与 MaiBot、DeepSeek 无官方隶属或背书关系。[设计来源](docs/DESIGN-ORIGIN.md)记录可核实的主题来源链。

## 功能

- 使用当前 DSH 的会话、模型、工作区与插件；支持会话排序、分组、文件预览及顶部审批。
- 技能中心、任务看板和记忆插件按宿主能力显示；纸航不捆绑这些插件。
- CMD 与共享浏览器工具分别开关，默认关闭；启用后通过 DSH 的工具与审批机制执行。[工具说明](docs/AGENT-TOOLS.md)

## 下载和安装

这是公开预览版，尚未完成新版跨设备验收与社区市场收录。请从本仓库 Releases 下载预构建插件 tgz；完整源码和 SHA256SUMS 同版提供。已知限制见发布检查，桌面版兼容性尚未验证。

安装插件 tgz，不要安装本源码目录或 GitHub 自动生成的源码 ZIP。步骤见[换设备安装与验收](docs/SECOND-DEVICE.md)。原生设置入口更名为「纸航 Paperflight」；为保持升级兼容，包名仍是 dsh-mai-shell，原有插件 ID、数据目录、路由及工具名不变。

测试包附完整对应源码、第三方许可证及校验清单，不携带 DSH 主程序、账号、聊天记录、模型密钥、用户工作区或第三方插件数据库。

## 构建

需要 Node.js 22.12+ 和 npm：

```sh
npm run setup
npm test
npm run pack:local
npm run verify:package
```

[构建说明](docs/BUILD.md)。frontend 为界面，server 为适配服务，plugin 为宿主入口，licenses/provenance 保存来源及许可证据。插件内含完整 source/ 和可在设置中下载的同版源码。

## 验证范围与发布状态

已验证基线为 Windows / DSH Web 0.2.0-rc.2。各版本证据和剩余待办见[发布检查](docs/RELEASE-CHECKLIST.md)，构建与单元回归不等于新设备或全部网页兼容验收。官方 DSH 桌面版已发布，但纸航尚未完成桌面版兼容测试。

## 来源、许可与隐私

[LICENSE](LICENSE) · [NOTICE](NOTICE.md) · [数据处理说明](docs/PRIVACY.md) · [素材与许可](docs/ASSET-LICENSES.md)。保留上游署名和 AGPL 义务；产品改名不改变许可证。问题反馈请使用本仓库 Issues，删除密钥、私人路径与聊天内容后再提交。

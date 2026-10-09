# 纸航 Paperflight：名称与设计来源

核对日期：2026-10-08。名称由用户确认，中文「纸航」，英文 Paperflight，对外完整名称 Paperflight for DSH。

## 可核实的来源链

1. **MaiBotOneKey**：SengokuCola，2026-05-25，提交 [2c78873](https://github.com/Mai-with-u/MaiBotOneKey/commit/2c788736c75aee80379efe6a9ac2d253d972177c)，说明「feat: 新增未来复古」。提交加入纸纹 SVG、青色墨线、锈橙色、切角面板及 retro-shell/retro-panel 等项目样式；未新增外部主题依赖。
2. **MaiBot Dashboard**：同一作者，2026-05-26，提交 [d9f7884](https://github.com/Mai-with-u/MaiBot/commit/d9f7884f988126c0abbc4c16c4bb247b4761967d)，说明「feat: 为webui添加与一键包一致的主题」。[官方 WebUI 文档](https://docs.mai-mai.org/manual/webui/)也说明它与一键包外壳共用纸面、描边和切角风格。
3. **纸航 Paperflight**：从 MaiBot Dashboard 1.7.3 复制基线发展而来，加入 DSH 的会话、工具、审批与工作区适配。实际复制基线只有文件散列，不能把上述主题首发提交当作复制基线提交。

## 是不是现成 UI 库？

基础组件来自 shadcn/ui；MaiBot 的 components.json 采用 new-york 风格。但 shadcn/ui 不是这套未来复古主题的名称。[OneKey 外观架构文档](https://github.com/Mai-with-u/MaiBotOneKey/blob/main/APPEARANCE_ARCHITECTURE.md)将现代基础结构和未来复古样式分支分别描述。

目前核实到的最早实现是 OneKey 上述提交。没有发现更早的独立开源主题库署名；这既不能证明完全原创，也不能仅凭类似外观归因于其他设计系统。将来若发现明确上游声明，应补充本记录与 NOTICE。

## 命名与兼容

纸航呼应纸面质感与彩色航线，也区分于上游 MaiBot。此次改名保留技术标识 dsh-mai-shell、mai_cmd、mai_browser 与存储目录，避免已有配置、会话工具记录和升级路径失效。项目标识为非官方，不冒充 DeepSeek 产品。

## 后续桌面测试

[DeepSeek 官方下载页](https://www.deepseek.com/download/)已提供 Harness Windows 和 Apple Silicon macOS 桌面端。发布存在已确认，纸航兼容性尚未确认；需要分别验证插件加载入口、回环服务、默认路由、终端/浏览器、启停和卸载，不能沿用 Web 版通过结论。

# 来源、版权与修改声明

纸航 Paperflight for DSH（原 DSH Mai Shell）是基于 MaiBot Dashboard 改造的非官方 DSH Web 界面，整理日期 2026-10-08。上游作者与第三方权利人的版权声明均保留；本说明不代表上游为本项目背书。

## MaiBot Dashboard

前端最初复制自 MaiBot Dashboard 1.7.3，项目地址：
https://github.com/Mai-with-u/MaiBot/tree/main/dashboard

Dashboard 自身采用 AGPL v3，原许可证全文保留于根目录 LICENSE。本项目自己的外壳适配代码按 AGPL-3.0-only 提供。MaiBot 主程序的 GPL/EULA 不能替代 Dashboard 目录的 AGPL 条件。

2026-09-26 保存了最初复制文件的散列；未记录可证明对应关系的上游 commit，因此不虚构来源提交号。`provenance/upstream-manifest.json` 是复制基线；`provenance/changes.json` 是本次整理时相对基线的修改、删除和新增文件清单，数量仅代表文件，不能解释成功能接入比例。

主要修改包括：DSH 数据适配、会话侧栏与工作区、账号与插件页面、权限/预设、未来复古主题收敛、插件启停入口和独立打包。改动日期与版本说明见 CHANGELOG.md。

## 未来复古主题的历史来源

已核实的主题实现链为 MaiBotOneKey → MaiBot Dashboard → 本项目。SengokuCola 在 2026-05-25 的 MaiBotOneKey 提交 2c788736c75aee80379efe6a9ac2d253d972177c 中加入未来复古主题；同一作者在 2026-05-26 的 MaiBot 提交 d9f7884f988126c0abbc4c16c4bb247b4761967d 中说明将一键包主题加入 WebUI。它使用 shadcn/ui 基础组件，上述纸纹、配色、切角和条带由项目样式实现。目前未找到更早独立主题库的来源声明，不能据此断言视觉风格完全原创。

OneKey：https://github.com/Mai-with-u/MaiBotOneKey/commit/2c788736c75aee80379efe6a9ac2d253d972177c

Dashboard：https://github.com/Mai-with-u/MaiBot/commit/d9f7884f988126c0abbc4c16c4bb247b4761967d

这两个历史提交说明主题演进，不是本项目复制基线的提交号。本轮没有从 OneKey 新复制代码。详见 source/docs/DESIGN-ORIGIN.md（源码仓库中为 docs/DESIGN-ORIGIN.md）。

## dshmarket

`server/vendor/dshmarket/lib/catalog-local-match.js` 来自 dshmarket 1.65.3。原 MIT 许可及作者版权声明保留在旁侧 LICENSE，不将其改写为本项目原创。

## 字体、图标和其他依赖

- JetBrains Mono：The JetBrains Mono Project Authors，SIL OFL 1.1；全文在 `licenses/JetBrainsMono-OFL.txt`，同时随字体分发。
- Streamline Sharp / Block 图标：Streamline，https://github.com/webalys-hq/streamline-vectors ，CC BY 4.0，https://creativecommons.org/licenses/by/4.0/ 。本项目复用上游内联图标数据并通过 currentColor 着色/缩放；本轮未修改矢量路径。逐图标来源比对见素材清单；未比对项不得据此认定已清权。
- npm 软件包：版本及声明的许可证见 `provenance/dependencies.json`；安装得到的许可证/NOTICE 文件收集在 `licenses/npm/`。该自动清单不是法律兼容性审查结论。
- PDF.js 静态支持文件及内含字体、编解码器：原有独立许可文件保留在 `frontend/public/pdfjs/`。
- 模型头像使用本项目新绘制的 SVG，占位图同按 AGPL-3.0-only 提供；旧头像、MaiBot 图像和 VRM 已从当前版本移除。DSH 网页图标等材料见 `docs/ASSET-LICENSES.md`。DSH 图标在运行时从已安装宿主读取，本项目不打包该素材。

## 发布范围

本测试包不包含 DSH 主程序。发布前须核实素材授权、依赖义务、可获取的完整对应源码，以及交互界面的源码获取入口。当前仓库或资料中的“private”只是准备状态，不是对 AGPL 接收者权利施加额外限制。

Engram memory library panel: derived from @kenz1117/dsh-engram 0.7.13, Copyright (c) 2026 KenZ (kenz1117), MIT. See licenses/dsh-engram-MIT.txt and provenance/engram-panel.json.

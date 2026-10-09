# 素材与许可核对

本表区分代码许可与素材权利，审计日期 2026-10-01。文件散列和字体内部元数据见 `provenance/assets.json`，便于后续替换后重新核对。

| 资源 | 已有证据 | 当前结论与后续 |
| --- | --- | --- |
| MaiBot Dashboard 代码 | 复制基线及 Dashboard LICENSE | 保留 AGPL 全文、来源和修改清单；未知上游 commit 如实记录 |
| dshmarket 本地目录匹配模块 | 文件旁 MIT LICENSE | 保留原版权及许可 |
| JetBrainsMono-Medium.ttf | 官方 OFL 与字体名称/版权元数据 | OFL 全文随字体附带；不要给字体改许可证 |
| Streamline 内联 Sharp/Block | Iconify 数据集许可元信息；路径比对结果在 provenance | CC BY 4.0；已补署名链接，当前 23 个本地图标路径均匹配；不能用 Iconify 代码的 MIT 代替图标许可 |
| PDF.js wasm/cmaps/字体 | public/pdfjs 中原有许可文件 | 原样保留；依赖库存同时记录 pdfjs-dist 版本 |
| model-avatars/deepseek.svg、codex.svg | 本项目绘制的几何矢量占位图，无旧头像图像数据 | AGPL-3.0-only；外观设置可关闭模型区分头像 |
| DSH 标签图标 | preview.37 不再复制 dsh.ico | 运行时仅取本机已安装 DSH 的 favicon.svg；安装包不含此素材 |
| 旧模型头像、maimai.ico、VRM | preview.19 已从当前源码和新包中移除 | 旧归档仅作历史记录，不作为本版交付物 |
| react.svg | 未被源码引用的上游示例资源 | preview.46 已移除，不再分发 |

## 许可依据

- Dashboard：https://github.com/Mai-with-u/MaiBot/blob/main/dashboard/LICENSE
- JetBrains Mono：https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt
- Streamline Sharp：https://github.com/iconify/icon-sets/blob/master/json/streamline-sharp.json
- Streamline Block：https://github.com/iconify/icon-sets/blob/master/json/streamline-block.json
- CC BY 4.0：https://creativecommons.org/licenses/by/4.0/

2026-10-08：补充 13 个原先未找到顶层许可证文件的依赖文本，证据见 `provenance/supplemental-licenses.json`。mime-match 与 wildcard 的许可位于发布提交的 README；victory-vendor 的 13 个嵌套第三方许可证一并保留。react-remove-scroll-bar 2.3.8 的 npm gitHead 在上游不可用，当前官方仓库版本仍为 2.3.7；已保留其 MIT 文本，但精确发布版本的文本来源仍标记待核实，不伪称版本完全对应。

依赖的自动许可统计需要结合实际分发代码和 NOTICE、字体、素材条款复核。目前没有把任何未确认素材标为“已获得授权”。

2026-10-09：preview.47 将 react-remove-scroll-bar 固定为兼容的 2.3.7。npm 发布提交的全部 src/ 文件与许可证所在提交逐项 blob 散列一致；因此关闭上述 2.3.8 的文本来源待办。证据见 provenance/scrollbar237-evidence.json；其他依赖锁定项未变。

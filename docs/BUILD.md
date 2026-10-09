# 从源码构建与本地验证

## 前提

Node.js 22.12+ 与其附带的 npm。源码包含 npm 锁文件，不依赖系统 pnpm。网络只在依赖尚未缓存时用于下载 npm 包；构建和测试本身不要求 DSH 运行，也不会使用真实账号。

在源码根目录执行：

```sh
npm run setup
npm test
npm run pack:local
npm run verify:package
```

setup 执行 `npm ci --legacy-peer-deps --ignore-scripts`，缓存保存在本目录 `.cache/npm/`。沿用既有锁文件的 peer 解析方式：React 19 与 Joyride 间接依赖声明存在版本范围不一致，legacy-peer-deps 只用于复现依赖树，不证明运行兼容；该问题仍须发布前验证/解决。当前构建所需工具随锁定依赖安装，无需额外运行安装脚本。请以验证记录为准，跨系统仍需重新验证。pack:local 先类型检查和构建，再生成两份本地 tgz；没有发布动作。

`frontend/tsconfig.preview.json` 检查当前应用入口及其依赖，排除上游测试。`npm test` 运行本项目 tests/ 的 Node 测试：入口跳转/停用回退、主题迁移、账号金额投影和子代理地址规则；不是完整端到端验收。

## 源码包的重建

将 `dsh-mai-shell-source-*.tgz` 解压到任意空目录，进入解压得到的 `package/`，运行上述命令即可。不复制原工作区 node_modules。插件包里的 `source/` 也采用相同布局和命令，可重建对应 payload 与插件入口。

插件的 `payload/` 在打包时由 `server/` 与 `frontend/dist/` 组成；`source/` 包含上述文件的首选修改形式、锁文件、构建脚本、测试和许可材料。源码快照按显式目录白名单生成。`MANIFEST.sha256.json` 不含自己；验证会核对其他所有文件和发布包散列。

## 生成的目录

- frontend/dist：Vite 输出，可重新生成。
- dist/package：插件组装目录，打包时安全清空后重建。
- dist/*.tgz：本地源码/插件归档。
- .cache、.verify：本地缓存和离线测试临时文件，不进入包。

修改源码后应重新执行 pack:local，不要手工修改生成目录。字体和图标在线材料由维护者核对后保存，常规构建不自动联网刷新它们。

## 宿主测试另行进行

安装到独立 DSH_HOME 后再验收启用/停用/卸载、正式插件共存、账号、文件、浏览器、终端、审查与窄屏布局。本机 preview.36 验收记录不能替代另一设备验收。首次打开需走宿主 `/mai-shell` 的鉴权入口。

## 不可发布状态

`npm run release:check` 应返回非零并列出尚未关闭的门槛；它不会上传。根目录与插件均设置 private，同时根目录含拒绝 npm publish 的钩子。不要为了消除提示直接把待办改为 PASS；应先补证据并取得发布指令。

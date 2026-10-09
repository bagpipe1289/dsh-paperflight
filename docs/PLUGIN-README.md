# 纸航 Paperflight for DSH 0.1.0-preview.47

非官方未来复古 Web 外壳。Windows / DSH 0.2.0-rc.2 基线的实验性公开预览包，完整跨设备和桌面版验收未完成。Node.js 22.12+。

从原生 DSH 插件管理安装本地 tgz，启用后从原生设置「纸航 Paperflight」进入。首次直接访问 3182 会缺少登录态。停用/卸载关闭外壳服务，保留会话和配置。完整步骤在 source/docs/SECOND-DEVICE.md。

AGPL-3.0-only，无担保。许可见 LICENSE、NOTICE.md；source/ 包含完整对应源码、锁文件、构建脚本与第三方许可，payload/corresponding-source.tgz 为同版下载包。设置页提供许可/隐私和本机源码下载入口。进入 source/ 执行 npm run setup、npm test、npm run pack:local 可重建。

不捆绑 DSH 主程序、账号、会话、个人头像、受限 VRM 或第三方插件运行数据。DSH 标签图标从已安装宿主读取，不随此包分发。

# PaperFlight 原生预设工具

为 DSH 编写或修改 Agent 预设，且用户需要 PaperFlight 的共享浏览器或 CMD 时读取本说明。仅在用户要求的预设中添加组件，不修改其他预设或全局审批策略。

将以下条目放入该预设 config.plugins 的工具组，与原生工具处于同一 tools 作用域：

```yaml
- id: pf-cmd
  name: dsh-paperflight/tool-cmd
- id: pf-browser
  name: dsh-paperflight/tool-browser
```

可以只加入一个组件。CMD 对模型注册 mai_cmd，浏览器注册 mai_browser。工具名不等于插件模块名。没有单独的预设白名单；不要编辑 agent-tools.json 的旧 presets 字段。

依赖：安装并启用 dsh-paperflight 主插件；预设提供原生 tools 服务。CMD 仅支持 Windows，并要求同一 Agent 可用标准非持久化 pwsh 工具（参数含 workdir、timeoutMs）；命令仍通过原生权限和沙箱执行。浏览器使用独立共享页面，不接管个人 Edge 登录状态。使用现有工具返回的元素信息操作，上传下载遵循工作区与审批限制。

全局工具停用开关可使声明的工具暂不可用。声明组件不代表免审批，也不授权扩大文件或网络访问范围。不要为了通过测试自行放宽权限。

保存后用原生预设目录检查 broken 状态、查看组成，再在空白测试会话核对实际工具目录。使用原生热更新生命周期；不要手动改写历史会话或已运行会话的预设事件。

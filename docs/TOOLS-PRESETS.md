# PaperFlight 工具作用域（preview.59）

PaperFlight 是 DSH 工作台，包含界面、会话与文件管理、可选浏览器和 CMD 模块。

## 原生预设声明

在原生预设 config.plugins 的工具作用域中加入所需组件：

```yaml
- id: pf-cmd
  name: dsh-paperflight/tool-cmd
- id: pf-browser
  name: dsh-paperflight/tool-browser
```

只需其中一种能力时只声明该组件。工具名继续使用 mai_cmd / mai_browser，兼容历史记录。没有 PF 专用的预设白名单。全局开关仅负责启停，不能代替原生预设声明；关闭会停止对应操作。模型工具目录、右侧入口根据实际作用域注册决定。

CMD 要求 Windows 及同一 Agent 可用的标准非持久化 pwsh（workdir、timeoutMs 参数）。共享浏览器使用独立临时页面。审批、沙箱和上传下载的工作区边界不因声明而改变。

插件提供按需技能 paperflight-preset-tools，说明模块、示例、依赖及验证；不额外注册模型工具来解释配置。

## 从旧配置迁移

旧 agent-tools.json.presets 已不参与授权。部署前备份 profile 的 cordis.patch.yml 及 agent-tools.json，将此前明确开启的选项写成对应预设的原生组件条目；不要向其他预设默认授权。保留全局 terminal/browser 值，移除旧 presets 映射。不存在、不可编辑或结构无法确认的预设需先核对，不猜测或更改原版预设。

## 下载诊断

仅在文件已经保存成功后，将同次下载操作的对应 document navigation 的 net::ERR_ABORTED 标记为 expected。完整 URL（内部用于匹配）和重定向链用于关联，展示仍去掉 query。此类记录最多保留两条，不挤占真正的失败；失败下载、其他请求中断照常保留。

## PowerShell 控制台报错

特定 Access is denied / console output buffer 报错可能来自进度条渲染。PF 保留原始错误，并提示在实际执行 Invoke-WebRequest 的 PowerShell 脚本内设置 `$ProgressPreference = 'SilentlyContinue'` 后检查。

CMD 包装器的父 PowerShell 设置不会自动传给用户命令启动的 powershell.exe，因此不静默重写用户命令，也不声称一个父进程变量能修复所有场景。本次不修改 DSH 自带 pwsh，不绕过沙箱或自动重试。

## 归档与整组删除

固定兼容矩阵：Windows、DSH 0.2.0-rc.2、JSONL 存储、社区 dsh-session-manager 0.6.3。

从已归档原始父会话发起，预览全部层级子代理（最多 200 条）并确认。所有记录必须已释放且未置顶；仍被占用时需要先重启 DSH，不自动停止用户任务。普通分叉、来自分叉的父会话不纳入连带删除。

确认票据绑定整组成员及版本；先获取全部公开写锁，再重新检查关系和版本，由社区删除器逐项从叶子到父会话删除，并核对持久化与索引消失。工作区文件、长期记忆不删除。

整组操作不是文件系统事务。中途失败会停止并报告已确认删除数量；不会谎报完整成功或自动重试。传输中断时保留全部保护锁至宿主退出。确认过期或成员变化必须重新确认。

## 验证边界

以隔离 DSH、真实 JSONL 和固定社区删除器验证；不删除用户实际会话，不调用模型。桌面版及其他后端仍需独立验收。

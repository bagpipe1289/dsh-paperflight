# 0.1.0-preview.48

- 公开插件包改名 dsh-paperflight，源码包与私有前端包同步采用 Paperflight 名称；旧包需先卸载再安装新版。
- 保留数据目录、插件实例 ID、路由、配置键与工具名，补充命名和迁移说明。
- 修正许可页仍指向旧私有仓库和使用旧标题的问题。
- 新设备安装、旧包迁移和桌面端兼容性仍需验收。

# 0.1.0-preview.47

- 固定兼容的滚动条依赖 2.3.7，核对发布源码与许可证所在提交一致，补齐最后一项来源证据。
- 准备纸航独立公开预览仓库与新版 Windows 安装清单；桌面版和新版跨设备验收尚未完成。

# 0.1.0-preview.46

- 产品命名为「纸航 Paperflight for DSH」，更新侧栏、网页标题与原生设置入口；保留插件 ID 和存储路径以兼容升级。
- 追溯 OneKey → MaiBot Dashboard 的主题来源，补充署名与设计来源记录。
- 补齐依赖许可证据和发布检查；候选包不代表已通过市场或桌面版验收。

# 0.1.0-preview.45

- 右侧栏收起条向页面内侧回移 4 px（两倍可见线宽）。

# 0.1.0-preview.44

- 会话内工作区文件链接直接打开右侧预览；Windows 路径不再变成空链接并打开第二个 DSH 窗口。
- 浏览器采样等待可访问内容短暂稳定，返回变化标记、加载提示与有限网络诊断；重复读取可省略未变化正文。
- 同一个 mai_browser 增加有界 wait/reload/scroll、按角色与名称局部读取、重复控件序号；保留所有权及修改操作审批。

# 0.1.0-preview.43

- 审批与提问从顶部提示栏向下展开，新请求自动展开，保留手动折叠和精确审批记忆。
- 共享浏览器操作顺序排队，慢网页不再等待全部脚本完成；连续画面独立于操作锁，面板可见时自动更新。
- 向上翻阅会话时回底箭头橙色进度逐渐增加；侧栏收起条加长、贴边并补上悬停位移。

## 0.1.0-preview.42

- 审批与提问恢复申请时自动弹窗，可折叠；新请求会重新展开。
- 增加可撤销的本会话相同工具、参数和原因审批记忆，进程重启后清除。
- 共享浏览器提供人机互斥接管、截图点击、输入、按键和滚动，保留同一页面上下文。
- 普通网页可传递网址到共享浏览器；支持拖入 Edge 地址栏链接，不迁移个人浏览器登录状态。
- CMD 命令可传到手动终端草稿，手动终端输出可传到聊天草稿；不共享进程与权限。

## 0.1.0-preview.41

- 聊天回到底部按钮复用主页回到顶部组件：保留进度边框、悬停、拖动定位与滑入滑出动画，滚动目标限定为聊天区。
- 右侧隐藏条与顶栏收起条共用组件和细线样式，采用竖向布局；隐藏时保留已打开的工具。

## 0.1.0-preview.40

- 未使用的空白会话切走后隐藏；保留当前会话、草稿、附件、置顶及手动命名的会话。使用宿主 blank 状态，不以消息预览推断。
- 列表标题与原生语义一致：新会话 / 未命名 / 已保存的标题。
- 日常界面品牌统一为 DSH，原生设置入口改为未来复古外壳；保留许可、来源与版权入口。
- 聊天向上翻阅时显示回到最新消息按钮；点击恢复跟随最新消息。

## 0.1.0-preview.39 — 2026-10-07

- 新增两个默认关闭的模型工具：CMD 与独立浏览器。开关实际注册/撤销工具，不只隐藏界面；不改变已有 DSH/MCP 工具。
- CMD 通过当前 Agent 可见的标准 pwsh 工具运行，保留宿主策略与沙箱，经过审批；新进程、单行命令、30 秒时限，关闭可取消。
- 浏览器复合工具提供打开、读取、点击、填写、按键、后退、关闭；使用独立临时 Edge，会话间隔离。右侧显示最近操作截图与结果。
- 设置页及右侧终端/浏览器提供统一开关，右侧分开「手动操作」与「DS 操作」。浏览器执行依赖锁定 playwright-core 1.63.0。
- 补充功能边界、数据处理和试用步骤；隔离适配器测试不代替真实模型/第二设备验收。

## 0.1.0-preview.38 — 2026-10-06

- Fix SSE heartbeat writes after a response ends; clean up subscriptions on finish, close, and error. Protect late frames and proxied memory streams from crashing the shell.
- Re-entering the authenticated native launcher can restart a stopped shell child, without restarting DSH. Concurrent opens share one startup; failures do not cause automatic restart loops.
- Add a right-side approval panel backed by the existing host approval/question queue, with a shared subscription and a conversation notice. Code review remains a separate tool.
- Mark sidebar terminal/browser as manual tools; model tool availability still comes from DSH plugins and presets.
- Unknown/inconsistent download totals display downloaded bytes with indeterminate progress, not 100 percent. Build stages do not reuse stale download percentages. Build-script rejection shows an actionable native-market authorization entry.
- No new model permissions and no automatic pnpm build-script authorization.

## 0.1.0-preview.37 · 2026-10-06

- 增加本机许可/隐私/对应源码下载入口和换设备测试说明。
- 不再分发未核清授权的 DSH ico，运行时使用已安装宿主图标。
- 准备私有 GitHub 预发布测试包；不发布 npm/插件市场。

## 0.1.0-preview.36

- 窄窗口日志页的视图切换放回内容区，避免与顶部导航重叠和误触；宽屏保留顶部切换。

## 0.1.0-preview.35

- 修正服务设置残留的验证版端口和文案，移除插件模式下不能执行的重启按钮，引导使用 DSH 管理器。

## 0.1.0-preview.34

- Show the actual unavailable state when the native schedule component is absent, instead of calling a missing endpoint.

## 0.1.0-preview.33

- Wait for a reachable native host before leaving the shell during a restart.
- Recover expired shell cookies through the current native origin without embedding launch credentials.

## 0.1.0-preview.32

- Hide skill, task, and memory navigation after their panel plugin is removed; refresh inventory while the page stays open.
- Hide management links for absent plugins in the workbench.
- Replace the Chinese loading message with the requested DeepSeek/token wording.

## 0.1.0-preview.31

- Restore the static orange indicator on the selected session only.
- Drag by the session row with a 6 px movement threshold; retain drop-to-group and prevent accidental session switching after a drag.
- Keep action menus independent; Alt+Arrow keys reorder the focused session.

# 修改记录

## 0.1.0-preview.29 — 2026-10-01（本地试用）

- 会话橙色条改为长按拖动手柄，支持组内排序、拖入空/折叠分组及移回未分组；保留置顶优先，键盘上下键可排序。
- 删除排序模式按钮，会话分组、视图切换、工作目录三个按钮排成一行。
- 子代理记录明确提示上传/直接发送限制并提供返回父会话入口；普通会话上传不变，原生子代理路由错误显示可操作的中文说明。

## 0.1.0-preview.28 — 2026-10-01（本地试用）

- 首页统计定时刷新保留当前画面，避免反复切回全页加载并重置卡片状态。

## 0.1.0-preview.27 — 2026-10-01（本地试用）

- 修正技能中心、任务看板路由仍挂在旧占位页的问题，实际挂载已实现的插件面板，并新增路由回归检查。
- 首页默认依次尝试 24 小时、7 天、30 天，选择最近的有数据范围；手动选定范围不被自动刷新覆盖。无记录以破折号显示，保留真实账号消费和服务运行时长。
- 工作区与扩展卡片加入小图标、指标分隔和底部操作分区。


## 0.1.0-preview.26 — 2026-10-01（本地试用）

- 技能中心增加已注册工作区选择；正式安装时将现有工作区技能目录加入技能插件的 customSkillDirs，修复冷启动没有活动会话时漏读项目技能。
- 工作台不再暗示所有已安装插件都有专属管理页。


## 0.1.0-preview.25 — 2026-10-01（本地试用）

- 市场安装增加真实分阶段进度、已处理量、当前包和等待提示；未知总量不显示虚构百分比。
- 撤下 OpenViking / Hindsight 无内置控制台的空管理入口；保留插件与运行状态识别。
- 首页旧存储占位卡改为真实会话及插件概况，补充空统计时段提示和 30 天切换入口。
- 技能中心增加新建、编辑、启停与移入回收目录；任务看板增加待办整理、删除草稿和自动刷新。
- 正式环境安装技能中心、任务看板 0.4.4。执行、调度和权限确认继续由插件原生界面处理。


## 0.1.0-preview.24 — 2026-10-01（本地试用）

- 修正正式环境复核发现的插件工作台列表变量遮蔽问题，增加混合插件目录回归检查。


## 0.1.0-preview.23 — 2026-10-01（本地试用）

- 反馈页过滤无正文工具步骤，复用原生消息评价、撤销、分类说明与会话反馈接口。
- 资源空位替换为技能中心和任务看板；按已安装插件状态开放原生接口适配。未安装时明确提示，技能目录可回退原生会话数据。
- 插件工作台集中专属页面、标准配置和浏览器本地管理入口。
- 长期记忆识别 Engram / OpenViking / Hindsight；后两者本轮仅完成识别与管理地址接入，不代表服务器部署或记忆读写已实现。
- 未安装新的第三方插件、未配置外部记忆服务、未发送测试反馈；相关端到端验收仍待补齐。


## 0.1.0-preview.22 — 2026-10-01（本地试用）

- 会话管理提供活动、已归档分类及数量，可取消归档。
- 修正现场验收发现的 selectedDefault 字段兼容问题；Agent 预设卡片可设置原生默认预设，保留版本冲突检测与设置备份；新会话默认跟随原生配置。
- 长期记忆接入 Engram 0.7.13 原有记忆库面板，复用本地插件接口；未安装隐藏导航，停用后禁用面板。
- 保留 Engram MIT 声明，调整局部配色、接口桥接和确认对话框。

## 0.1.0-preview.20 — 2026-10-01（本地试用）

- 会话绿点表示正在运行，空闲显示灰色；后台状态不再沿用旧会话缓存。
- 关闭模型头像后取消通用机器人和占位，会话状态点移到标题左侧。
- 外观设置可分别上传、恢复 DeepSeek/Codex 头像，限制 2 MB、转为 256px 静态 PNG，仅存于当前浏览器。
- 不发布到 GitHub 或插件市场；其余发布验收继续暂缓。

## 0.1.0-preview.19 — 2026-10-01（本地试用准备）

- 移除未接入的 VRM 模型及专注陪伴页面实现、旧模型头像与 MaiBot favicon。
- 新绘制两种几何 SVG 占位头像；外观设置新增“模型区分头像”开关，关闭使用通用图标，偏好保存在浏览器并同步更新已打开页面。
- 网页标签图标改用用户指定的原 DSH 图标，不修改其图像。
- 其他发布验收按用户要求暂缓；未上传、未替换正式插件。


## 0.1.0-preview.18 — 2026-10-01（仅本地准备）

- 将前端、插件入口和可读适配服务独立整理，移除打包脚本对相邻开发目录和本机路径的依赖。
- 新增锁文件安装、类型检查、离线回归测试、源码/插件打包、文件散列验证与来源差异报告。
- 将更新页固定的旧宿主版本号改为读取当前宿主传入的版本。
- 保留上游 AGPL、dshmarket MIT 和 PDF.js 各资源许可；补充字体/图标材料、依赖库存、隐私草案和公开发布待办。
- 标记头像、MaiBot 图像、VRM 等素材的授权缺口，没有借 AGPL 声明覆盖未确认的素材权利。
- 没有上传源码、公开仓库、发布市场包或替换正式安装。

## 整理前开发阶段 — 2026-09-26 至 2026-09-30

基于 Dashboard 1.7.3 初始副本逐步加入 DSH 会话、子代理、权限、账号、插件市场、预设、工作区等适配；preview.17 收敛为未来复古主题。本段仅概述已继承的开发历史，不声称每项都完成了正式宿主验收，也不推定各文件的精确修改日期。逐文件基线见 provenance。

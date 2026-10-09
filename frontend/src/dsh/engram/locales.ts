/**
 * 「记忆库」client 词典：zh/en 键并集必须完全一致（类型化注册的编译约束）。
 * 数据层英文枚举（status/kind/op 等）只在显示层映射，存储值保持英文不变。
 * @module @kenz1117/dsh-engram/client/locales
 */

/** 词典命名空间（同时用作 LocaleNamespaceMap 的声明合并键）。 */
export const NS = 'engram'

/** 「记忆库」全部界面文案键。 */
export type EngramKey =
  | 'nav'
  | 'scopeUser'
  | 'scopeProject'
  | 'scopeShared'
  | 'projectFollow'
  | 'projectFollowNamed'
  | 'projectFollowHint'
  | 'projectPinned'
  | 'projectUnregistered'
  | 'projectNoWorkspace'
  | 'projectSwitch'
  | 'projectMemories'
  | 'projectProcessDefault'
  | 'refresh'
  | 'exportMd'
  | 'exportJson'
  | 'export'
  | 'exportMirror'
  | 'exportMdHint'
  | 'exportJsonHint'
  | 'exportMirrorHint'
  | 'allStatuses'
  | 'allKinds'
  | 'redactedAll'
  | 'redactedOnly'
  | 'redactedNone'
  | 'tagRedacted'
  | 'tagOutcomeSuccess'
  | 'tagOutcomeFailure'
  | 'searchPlaceholder'
  | 'statusActive'
  | 'statusArchived'
  | 'statusForgotten'
  | 'kindFact'
  | 'kindPreference'
  | 'kindDecision'
  | 'kindEpisode'
  | 'kindSkill'
  | 'labelContent'
  | 'labelKind'
  | 'labelStatus'
  | 'labelScope'
  | 'importance'
  | 'confidence'
  | 'accessCount'
  | 'labelCreated'
  | 'timeJustNow'
  | 'timeMinutesAgo'
  | 'timeHoursAgo'
  | 'timeDaysAgo'
  | 'sourceExplicit'
  | 'sourceSession'
  | 'round'
  | 'cardRedacted'
  | 'detail'
  | 'edit'
  | 'forget'
  | 'restore'
  | 'empty'
  | 'loadFailed'
  | 'loading'
  | 'pagerInfo'
  | 'prevPage'
  | 'nextPage'
  | 'cancel'
  | 'saveWithHint'
  | 'detailAttributes'
  | 'detailSource'
  | 'detailRelations'
  | 'detailOperations'
  | 'headerTitle'
  | 'headerSubtitle'
  | 'tabToday'
  | 'tabLibrary'
  | 'tabCorridor'
  | 'tabLog'
  | 'tabLibraryCount'
  | 'roomsTitle'
  | 'roomsHint'
  | 'healthEvaluatedAt'
  | 'logFilterAll'
  | 'logFilterWrite'
  | 'logFilterIngest'
  | 'logFilterRetrieve'
  | 'logFilterOrganize'
  | 'logCount'
  | 'benchTitle'
  | 'drawerClose'
  | 'drawerTitle'
  | 'kpiTotal'
  | 'kpiActive'
  | 'kpiForgotten'
  | 'kpiSignal'
  | 'emptyHint'
  | 'relSupersededBy'
  | 'relSupersedes'
  | 'relContradicts'
  | 'relRelated'
  | 'opWrite'
  | 'opWriteMerge'
  | 'opUpdate'
  | 'opForget'
  | 'opRestore'
  | 'opDecay'
  | 'opSuperseded'
  | 'opIngestRequest'
  | 'opIngestDone'
  | 'opOutcomeReport'
  | 'opAssess'
  | 'opConsolidation'
  | 'opReviewAnswer'
  | 'opSlotAssign'
  | 'opSlotBackfill'
  | 'opRoomOpen'
  | 'consolidateArchived'
  | 'consolidateMerged'
  | 'consolidateSkipped'
  | 'decayArchived'
  | 'slotBackfilled'
  | 'roomOpened'
  | 'reviewAnswered'
  | 'assessAdequate'
  | 'assessInadequate'
  | 'assessRefs'
  | 'opSearchRewrite'
  | 'opCompressRequest'
  | 'opDistillRequest'
  | 'selectAll'
  | 'deselectAll'
  | 'selectedCount'
  | 'batchForget'
  | 'batchForgetConfirm'
  | 'batchRestore'
  | 'clearSelection'
  | 'sectionCorridor'
  | 'corridorEmpty'
  | 'corridorFailed'
  | 'corridorLoad'
  | 'corridorAria'
  | 'corridorSummary'
  | 'edgeSupersedes'
  | 'edgeContradicts'
  | 'edgeOther'
  | 'healthLoading'
  | 'teleFailed'
  | 'teleLoading'
  | 'teleGroupRecent'
  | 'telePrivacyHint'
  | 'telePrivacyTip'
  | 'teleWrites'
  | 'teleIngest'
  | 'teleConsolidate'
  | 'benchPlaceholder'
  | 'benchRun'
  | 'benchScopeAll'
  | 'benchHits'
  | 'benchDegraded'
  | 'benchEmpty'
  | 'benchNote'
  | 'viaFts'
  | 'viaVec'
  | 'viaBoth'
  | 'viaEdgeLabel'
  | 'benchRewrite'
  | 'benchCompress'
  | 'activityEmpty'
  | 'detailRevisions'
  | 'tourProposalTitle'
  | 'tourProposalEmpty'
  | 'tourProposalHint'
  | 'tourFocusAll'
  | 'refurbTitle'
  | 'refurbEmpty'
  | 'refurbRun'
  | 'refurbActionDemote'
  | 'refurbActionMerge'
  | 'refurbActionReview'
  | 'refurbActionSplit'
  | 'refurbCount'
  | 'refurbExecute'
  | 'refurbConfirmDemote'
  | 'refurbConfirmMerge'
  | 'refurbDemoteDone'
  | 'refurbMergeDone'
  | 'refurbActionFailed'
  | 'refurbMergeEmpty'
  | 'heroDue'
  | 'filterDueToday'
  | 'sortTime'
  | 'sortTour'
  | 'dueBadgeLabel'
  | 'tabBackfill'
  | 'backfillIntro'
  | 'backfillRulesTitle'
  | 'backfillDays'
  | 'backfillDaysAll'
  | 'backfillDaysUnit'
  | 'backfillMaxTurns'
  | 'backfillMaxTotal'
  | 'backfillModel'
  | 'backfillModelAuto'
  | 'backfillIncludeSubagents'
  | 'backfillIncludeSeeded'
  | 'backfillIncludeNoCwd'
  | 'backfillReestimate'
  | 'backfillEstimateTitle'
  | 'backfillCandidates'
  | 'backfillPendingTurns'
  | 'backfillAlready'
  | 'backfillSkippedDetail'
  | 'backfillTruncated'
  | 'backfillStart'
  | 'backfillPause'
  | 'backfillStateRunning'
  | 'backfillStateDone'
  | 'backfillStateCancelled'
  | 'backfillStateFailed'
  | 'backfillProgressSessions'
  | 'backfillProgressTurns'
  | 'backfillWritten'
  | 'backfillTurnsSkipped'
  | 'backfillTurnsFailed'
  | 'backfillFailures'
  | 'backfillEstimating'
  | 'backfillSkipReasons'
  | 'backfillRouteHint'
  | 'skipLowActivity'
  | 'skipChitchat'
  | 'skipForbidden'
  | 'skipNoContent'
  | 'skipAlready'
  | 'skipNoTurn'
  | 'skipNoRoute'
  | 'skipUnparsable'
  | 'opProfileEdit'
  | 'profileOpCreate'
  | 'profileOpEdit'
  | 'profileOpRollback'
  | 'profileTitle'
  | 'profileEmpty'
  | 'profileEmptyHint'
  | 'profileCurrent'
  | 'profileHistory'
  | 'profileSourceEdit'
  | 'profileSourceRollback'
  | 'profileDiffBase'
  | 'profileDiffTarget'
  | 'profileDiffNone'
  | 'profileLoadFailed'
  | 'tabEpisodes'
  | 'episodeSince'
  | 'episodeUntil'
  | 'episodeSessionId'
  | 'episodeApply'
  | 'episodeReset'
  | 'episodeHint'
  | 'episodeNoGroups'
  | 'episodeNoSession'
  | 'episodeSummaryMissing'
  | 'episodeEntries'
  | 'episodeNearby'
  | 'episodeAroundTitle'
  | 'episodeAroundEmpty'
  | 'episodeClose'
  | 'tabEntities'
  | 'entityHint'
  | 'entityKindAll'
  | 'entityKindPerson'
  | 'entityKindProject'
  | 'entityKindTool'
  | 'entityKindConcept'
  | 'entityKindOther'
  | 'entitySearchPlaceholder'
  | 'entityCount'
  | 'entityMemories'
  | 'entityOpen'
  | 'entityAliases'
  | 'entityNoMemories'
  | 'entityEmpty'
  | 'factSection'
  | 'factEmpty'
  | 'factValid'
  | 'factInvalid'
  | 'tabJev'
  | 'jevIntro'
  | 'jevEnabled'
  | 'jevStatusOn'
  | 'jevStatusOff'
  | 'jevApiKey'
  | 'jevApiKeyHint'
  | 'jevApiKeyUnset'
  | 'jevClearKey'
  | 'jevKeyCleared'
  | 'jevBaseUrl'
  | 'jevModel'
  | 'jevTimeoutMs'
  | 'jevThresholdsTitle'
  | 'jevThresholdLine'
  | 'jevSave'
  | 'jevSaved'
  | 'jevLoadFailed'
  | 'jevTest'
  | 'jevTestOk'
  | 'jevTestFail'
  | 'jevObsTitle'
  | 'jevObsEmpty'
  | 'jevObsLoadFailed'
  | 'jevObsSiteBand'
  | 'jevObsSiteContradiction'
  | 'jevObsVerdictMerge'
  | 'jevObsVerdictAccept'
  | 'jevObsVerdictDefer'
  | 'jevObsVerdictConfirm'
  | 'jevObsVerdictReject'
  | 'jevObsVerdictFallback'
  | 'jevObsNoAnswer'
  | 'jevObsErrorLine'

/** kind 数据值 → 词典键（面板与走廊图共用一份，避免两处各自硬编码房间名）。 */
export const KIND_KEY: Readonly<Record<string, EngramKey>> = {
  fact: 'kindFact',
  preference: 'kindPreference',
  decision: 'kindDecision',
  episode: 'kindEpisode',
  skill: 'kindSkill',
}

/** 中文词典（宿主默认语言）。整页采用「记忆宫殿」语言：宫殿 / 房间（kind 分组）/ 记忆 / 铭牌 / 参观 / 管家 / 走廊。
   数据层英文枚举（status/kind/op）不在此映射，文案键保持稳定以保证编译约束。 */
export const zh: Record<EngramKey, string> = {
  nav: '记忆宫殿',
  scopeUser: '私人宫殿',
  scopeProject: '项目宫殿',
  scopeShared: '共享宫殿',
  projectFollow: '跟随当前工作区',
  projectFollowNamed: '项目 · 跟随 {name}',
  projectFollowHint: '项目宫殿跟随 GUI 当前选中的工作区（按会话归属判定）',
  projectPinned: '项目 · {name}',
  projectUnregistered: '未注册工作区',
  projectNoWorkspace: '无工作区信息（进程默认）',
  projectSwitch: '项目宫殿来源',
  projectMemories: '{n} 条记忆',
  projectProcessDefault: '进程默认目录',
  refresh: '重访',
  exportMd: '导出 MD',
  exportJson: '导出 JSON',
  export: '导出',
  exportMirror: '镜像目录',
  exportMdHint: '单文件，可直接分享',
  exportJsonHint: '结构化全文，便于程序处理',
  exportMirrorHint: '每条记忆一个 .md，可用 Obsidian 漫游',
  allStatuses: '全部状态',
  allKinds: '全部房间',
  redactedAll: '全部铭牌',
  redactedOnly: '含涂改',
  redactedNone: '无涂改',
  tagRedacted: '已涂改',
  tagOutcomeSuccess: '管家验证·有效',
  tagOutcomeFailure: '管家验证·失效',
  searchPlaceholder: '在宫殿里寻找…',
  statusActive: '对外开放',
  statusArchived: '展厅陈列',
  statusForgotten: '已闭馆',
  kindFact: '事实厅',
  kindPreference: '偏好阁',
  kindDecision: '决策堂',
  kindEpisode: '往事廊',
  kindSkill: '技法坊',
  labelContent: '铭牌',
  labelKind: '房间',
  labelStatus: '状态',
  labelScope: '宫殿归属',
  importance: '地标亮度',
  confidence: '考据可靠度',
  accessCount: '参观 {n} 人次',
  labelCreated: '开馆时间',
  timeJustNow: '方才',
  timeMinutesAgo: '{n} 分钟前',
  timeHoursAgo: '{n} 小时前',
  timeDaysAgo: '{n} 天前',
  sourceExplicit: '管理员添置',
  sourceSession: '发掘地 {id}',
  round: '第 {n} 趟',
  cardRedacted: '涂改 {n}',
  detail: '参观',
  edit: '修缮',
  forget: '封门',
  restore: '重开',
  empty: '宫殿暂无可陈展的记忆',
  emptyHint: '试试调整房间筛选，或新添一条',
  loadFailed: '访客受挫：{msg}',
  loading: '导览中…',
  pagerInfo: '第 {page} / {pages} 页 · 共 {total} 条',
  prevPage: '上一页',
  nextPage: '下一页',
  cancel: '作罢',
  saveWithHint: '修缮（旧铭牌归展厅）',
  detailAttributes: '铭牌',
  detailSource: '发掘地',
  detailRelations: '邻接走廊',
  detailOperations: '管家日志',
  relSupersededBy: '被替代',
  relSupersedes: '替代',
  relContradicts: '互斥',
  relRelated: '相邻',
  headerTitle: '记忆宫殿',
  headerSubtitle: '跨会话长期记忆宫殿',
  tabToday: '今日',
  tabLibrary: '陈展',
  tabCorridor: '走廊',
  tabLog: '日志',
  tabLibraryCount: '{n} 条',
  roomsTitle: '房间目录',
  roomsHint: '每间满 9 个桩位后开新间',
  healthEvaluatedAt: '诊脉于 {time}',
  logFilterAll: '全部',
  logFilterWrite: '落成类',
  logFilterIngest: '发掘',
  logFilterRetrieve: '检索',
  logFilterOrganize: '整理',
  logCount: '{n} 条 · 两库合并倒序',
  benchTitle: '检索实验台',
  drawerClose: '归殿',
  drawerTitle: '记忆铭牌',
  kpiTotal: '记忆',
  kpiActive: '开放',
  kpiForgotten: '闭馆',
  kpiSignal: '清晰度',
  opWrite: '落成',
  opWriteMerge: '落成·并入',
  opUpdate: '修缮',
  opForget: '封门',
  opRestore: '重开',
  opDecay: '闭门陈列',
  opSuperseded: '被替代',
  opIngestRequest: '发掘请求',
  opIngestDone: '发掘完成',
  opOutcomeReport: '管家验证',
  opAssess: '证据判定',
  opConsolidation: '闭馆整理',
  opReviewAnswer: '复习答题',
  opSlotAssign: '排桩',
  opSlotBackfill: '批量排桩',
  opRoomOpen: '开新房',
  consolidateArchived: '归档 {n}',
  consolidateMerged: '合并 {n}',
  consolidateSkipped: '跳过 {n}',
  decayArchived: '归档 {n}',
  slotBackfilled: '新排 {n} 个桩位',
  roomOpened: '开新房 {room}',
  reviewAnswered: '评分 {grade} · 下次 {days} 天后',
  assessAdequate: '证据充足',
  assessInadequate: '证据不足',
  assessRefs: '{n} 条证据',
  opSearchRewrite: '路线改写',
  opCompressRequest: '导览压缩',
  opDistillRequest: '合并房间',
  selectAll: '本页全选',
  deselectAll: '取消全选',
  selectedCount: '已选 {n} 条',
  batchForget: '批量封门（{n}）',
  batchForgetConfirm: '确认封门 {n} 条？',
  batchRestore: '批量重开（{n}）',
  clearSelection: '清空所选',
  sectionCorridor: '走廊鸟瞰',
  corridorEmpty: '走廊空空如也，落成几条记忆后这里会出现鸟瞰图。',
  corridorFailed: '走廊加载失败',
  corridorLoad: '加载走廊鸟瞰…',
  corridorAria: '走廊鸟瞰图',
  corridorSummary: '{nodes} 条记忆 · {edges} 条走廊',
  edgeSupersedes: '推陈出新',
  edgeContradicts: '互斥',
  edgeOther: '相邻 / 支持 / 提炼',
  healthLoading: '正在诊脉…',
  teleFailed: '遥测加载失败',
  teleLoading: '聚合管家记录中…',
  teleGroupRecent: '近 7 天',
  telePrivacyHint: '数据仅在本机聚合 · 不外传',
  telePrivacyTip: '所有 op_log 与遥测计数只在当前进程的 SQLite 里聚合，从未发送至任何外部服务；本机重启或卸载插件即清空。',
  teleWrites: '落成',
  teleIngest: '发掘',
  teleConsolidate: '整理',
  benchPlaceholder: '说出要找的房间关键词或语义…',
  benchRun: '出发',
  benchScopeAll: '全部宫殿',
  benchHits: '到访 {n} 间',
  benchDegraded: '语义灯熄，仅关键词引路',
  benchEmpty: '此路不通',
  benchNote: '试走与正式导览共用同一张地图，会计入参观人次',
  viaFts: '关键词',
  viaVec: '语义',
  viaBoth: '双路',
  viaEdgeLabel: '邻接走廊',
  benchRewrite: '路线改写为 {n} 段',
  benchCompress: '铭牌压缩 {n} 条',
  activityEmpty: '暂无管家活动',
  detailRevisions: '陈展沿革',
  tourProposalTitle: '入殿导航',
  tourProposalEmpty: '宫殿尚空，建议先放第一段记忆（调用 engram_save）',
  tourProposalHint: '点击记忆可展开抽屉查看铭牌',
  tourFocusAll: '全部',
  refurbTitle: '翻新清单',
  refurbEmpty: '所有房间状态健康，无翻新建议',
  refurbRun: '重新扫描',
  refurbActionDemote: '降级',
  refurbActionMerge: '合并',
  refurbActionReview: '复习',
  refurbActionSplit: '拆分',
  refurbCount: '{n} 条建议',
  refurbExecute: '执行',
  refurbConfirmDemote: '确认降级这条记忆？执行后状态转 archived，可在统计页恢复。',
  refurbConfirmMerge: '确认合并 {n} 条相似记忆？将触发 engram_distill 把它们归纳为 1 条高层规律。',
  refurbDemoteDone: '已降级',
  refurbMergeDone: '合并任务已派发',
  refurbActionFailed: '执行失败：{msg}',
  refurbMergeEmpty: '无可合并的候选条目',
  heroDue: '今日到期',
  filterDueToday: '今日到期',
  sortTime: '按时间',
  sortTour: '按巡游路线',
  dueBadgeLabel: '今日到期 {n} 条，点击在陈展中筛选',
  tabBackfill: '回填',
  backfillIntro: '把 dsh 的历史会话逐轮提炼进宫殿：每条会话写进它自己 cwd 对应的项目库；已摄取过的轮次按幂等键自动跳过，中断后再次开始即可续做。回填的条目不会进入今日复习队列。',
  backfillRulesTitle: '导入规则',
  backfillDays: '时间窗',
  backfillDaysAll: '不限',
  backfillDaysUnit: '{n} 天',
  backfillMaxTurns: '单会话最多轮数',
  backfillMaxTotal: '本次总轮数上限',
  backfillModel: '辅助模型',
  backfillModelAuto: '自动（用当前在用的模型）',
  backfillIncludeSubagents: '包含子代理会话',
  backfillIncludeSeeded: '包含种子会话',
  backfillIncludeNoCwd: '包含无 cwd 会话（只能进私人宫殿）',
  backfillReestimate: '重新估算',
  backfillEstimateTitle: '估算',
  backfillCandidates: '候选会话 {n}',
  backfillPendingTurns: '待处理 {n} 轮',
  backfillAlready: '已摄取跳过 {n} 轮',
  backfillSkippedDetail: '已排除：子代理 {subagent} · 种子 {seeded} · 无 cwd {noCwd} · 超时间窗 {tooOld} · 日志不可读 {unreadable}',
  backfillTruncated: '候选超出总轮数上限：本次只处理最近的一部分会话，可调大上限或分几次跑',
  backfillStart: '开始回填',
  backfillPause: '暂停',
  backfillStateRunning: '回填中…',
  backfillStateDone: '已完成',
  backfillStateCancelled: '已中止（可再次开始续做）',
  backfillStateFailed: '失败',
  backfillProgressSessions: '会话 {done}/{total}',
  backfillProgressTurns: '轮次 {done}/{total}',
  backfillWritten: '写入 {n} 条',
  backfillTurnsSkipped: '跳过 {n} 轮',
  backfillTurnsFailed: '失败 {n} 轮',
  backfillFailures: '失败明细',
  backfillEstimating: '正在估算…',
  backfillSkipReasons: '跳过原因',
  backfillRouteHint: '失败多半是因为历史会话当时用的模型在当前环境不可用：可在 cordis.yml 配置 provider/model，或先用目标模型跑一轮会话（回填会复用当前在用的模型）再重试——已完成的轮次会自动跳过。',
  skipLowActivity: '低活动轮',
  skipChitchat: '寒暄轮',
  skipForbidden: '显式禁记',
  skipNoContent: '无用户内容',
  skipAlready: '已摄取',
  skipNoTurn: '无此轮',
  skipNoRoute: '日志无路由',
  skipUnparsable: '提炼输出不可解析',
  opProfileEdit: '画像修订',
  profileOpCreate: '创建 v{to} · {chars} 字',
  profileOpEdit: '编辑 v{from}→v{to} · {chars} 字',
  profileOpRollback: '回滚 v{from}→v{to}（还原 v{restored}）· {chars} 字',
  profileTitle: '画像 curated block',
  profileEmpty: '尚无 curated 画像',
  profileEmptyHint: '在会话里让 agent 调 engram_profile_edit 创建；创建后会话开始时优先于自动派生画像注入。',
  profileCurrent: '当前内容 · v{n}',
  profileHistory: '版本历史（新→旧）',
  profileSourceEdit: '编辑',
  profileSourceRollback: '回滚',
  profileDiffBase: '基准版本',
  profileDiffTarget: '对比版本',
  profileDiffNone: '两个版本内容相同',
  profileLoadFailed: '画像加载失败',
  tabEpisodes: '往事',
  episodeSince: '开始日期',
  episodeUntil: '结束日期',
  episodeSessionId: '会话 id（可选）',
  episodeApply: '应用',
  episodeReset: '重置',
  episodeHint: '按会话分组浏览经历；组头是摄取时生成的一句话摘要，点条目的「邻近」看当时前后还发生了什么',
  episodeNoGroups: '该范围内没有情景记忆',
  episodeNoSession: '无会话来源',
  episodeSummaryMissing: '（该会话尚未生成摘要：跑一次历史回填即可补上）',
  episodeEntries: '{n} 条情景',
  episodeNearby: '邻近',
  episodeAroundTitle: '时间邻近扩展',
  episodeAroundEmpty: '邻近窗口内没有其他情景',
  episodeClose: '收起',
  tabEntities: '实体',
  entityHint: '从记忆中抽取的人物、项目、工具与概念；点「查看」看一条实体牵出的所有记忆',
  entityKindAll: '全部类别',
  entityKindPerson: '人物',
  entityKindProject: '项目',
  entityKindTool: '工具',
  entityKindConcept: '概念',
  entityKindOther: '其他',
  entitySearchPlaceholder: '搜索实体名或别名',
  entityCount: '{n} 个实体',
  entityMemories: '{n} 条关联记忆',
  entityOpen: '查看',
  entityAliases: '别名',
  entityNoMemories: '暂无关联记忆',
  entityEmpty: '该宫殿还没有实体；保存带实体提及的记忆后会自动出现',
  factSection: '事实链（{n} 条）',
  factEmpty: '暂无事实；摄取时从记忆抽取的实体事实会出现在这里',
  factValid: '生效',
  factInvalid: '已失效',
  tabJev: '裁决',
  jevIntro: 'Jev 系统一裁决：写入落库前对模糊记忆做三路判定（合并 / 接受 / 搁置）并确认矛盾边。密钥保存在本机数据目录（0600 文件），保存后立即生效，无需重启；Jev 不可用时自动回落纯规则四态。',
  jevEnabled: '启用 Jev 裁决',
  jevStatusOn: 'Jev 裁决已生效',
  jevStatusOff: 'Jev 裁决未生效（纯规则四态）',
  jevApiKey: 'API 密钥',
  jevApiKeyHint: '留空表示保留现有密钥；要清除已存密钥（回落 cordis.yml 配置）点「清除已存密钥」。',
  jevApiKeyUnset: '未配置',
  jevClearKey: '清除已存密钥',
  jevKeyCleared: '已清除面板密钥，回落部署配置',
  jevBaseUrl: '端点',
  jevModel: '判决模型',
  jevTimeoutMs: '超时（毫秒，1000-60000）',
  jevThresholdsTitle: '裁决阈值（cordis.yml 高级配置，此处只读）',
  jevThresholdLine: '判同一条 ≥{merge} · 判不同条 ≤{accept} · 矛盾确认 ≥{contradict}',
  jevSave: '保存',
  jevSaved: '已保存，配置即时生效',
  jevLoadFailed: '加载失败',
  jevTest: '测试连接',
  jevTestOk: '连接正常：{ms} 毫秒，ping 概率 {p}',
  jevTestFail: '连接失败：{error}',
  jevObsTitle: '近期裁决（本进程，最多 50 条，重启清空）',
  jevObsEmpty: '暂无记录；启用 Jev 后发生写入裁决时出现',
  jevObsLoadFailed: '裁决记录加载失败',
  jevObsSiteBand: '模糊带',
  jevObsSiteContradiction: '矛盾确认',
  jevObsVerdictMerge: '并入',
  jevObsVerdictAccept: '放行',
  jevObsVerdictDefer: '搁置',
  jevObsVerdictConfirm: '确认矛盾',
  jevObsVerdictReject: '非矛盾',
  jevObsVerdictFallback: '回落',
  jevObsNoAnswer: '无答案',
  jevObsErrorLine: '错误：{error}',
}

/** 英文词典。整页采用「Memory Palace」语言：palace / room (kind group) / memory / placard / tour / curator / corridor。
   数据层英文枚举（status/kind/op）不在此映射，文案键保持稳定。 */
export const en: Record<EngramKey, string> = {
  nav: 'Memory Palace',
  scopeUser: 'Private Palace',
  scopeProject: 'Project Palace',
  scopeShared: 'Shared Palace',
  projectFollow: 'Follow the active workspace',
  projectFollowNamed: 'Project · following {name}',
  projectFollowHint: 'The project palace follows the workspace selected in the GUI (by session ownership)',
  projectPinned: 'Project · {name}',
  projectUnregistered: 'unregistered workspace',
  projectNoWorkspace: 'No workspace info (process default)',
  projectSwitch: 'Project palace source',
  projectMemories: '{n} memories',
  projectProcessDefault: 'Process default directory',
  refresh: 'Revisit',
  exportMd: 'Export MD',
  exportJson: 'Export JSON',
  export: 'Export',
  exportMirror: 'Mirror tree',
  exportMdHint: 'Single file, easy to share',
  exportJsonHint: 'Structured full dump for scripts',
  exportMirrorHint: 'One .md per memory, roamable in Obsidian',
  allStatuses: 'All statuses',
  allKinds: 'All rooms',
  redactedAll: 'All placards',
  redactedOnly: 'Redacted',
  redactedNone: 'Unredacted',
  tagRedacted: 'redacted',
  tagOutcomeSuccess: 'curator: worked',
  tagOutcomeFailure: 'curator: failed',
  searchPlaceholder: 'Wander the palace…',
  statusActive: 'open to public',
  statusArchived: 'on display',
  statusForgotten: 'closed',
  kindFact: 'Fact Hall',
  kindPreference: 'Preference Pavilion',
  kindDecision: 'Decision Chamber',
  kindEpisode: 'Episode Gallery',
  kindSkill: 'Skill Workshop',
  labelContent: 'Placard',
  labelKind: 'Room',
  labelStatus: 'Status',
  labelScope: 'Palace',
  importance: 'Beacon',
  confidence: 'Provenance',
  accessCount: '{n} visits',
  labelCreated: 'Opened',
  timeJustNow: 'just now',
  timeMinutesAgo: '{n} min ago',
  timeHoursAgo: '{n} hr ago',
  timeDaysAgo: '{n} d ago',
  sourceExplicit: 'Curator placed',
  sourceSession: 'Excavated at {id}',
  round: 'pass {n}',
  cardRedacted: '{n} redacted',
  detail: 'Tour',
  edit: 'Renovate',
  forget: 'Close',
  restore: 'Reopen',
  empty: 'No memories to display',
  emptyHint: 'Adjust the rooms above, or place a new memory',
  loadFailed: 'Tour halted: {msg}',
  loading: 'Guiding…',
  pagerInfo: 'Page {page} / {pages} · {total} memories',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  cancel: 'Cancel',
  saveWithHint: 'Renovate (archive old placard)',
  detailAttributes: 'Placard',
  detailSource: 'Excavation',
  detailRelations: 'Corridors',
  detailOperations: 'Curator log',
  relSupersededBy: 'Superseded by',
  relSupersedes: 'Supersedes',
  relContradicts: 'Contradicts',
  relRelated: 'Adjacent',
  headerTitle: 'Memory Palace',
  headerSubtitle: 'Cross-session long-term memory palace',
  tabToday: 'Today',
  tabLibrary: 'Palace',
  tabCorridor: 'Corridor',
  tabLog: 'Log',
  tabLibraryCount: '{n} memories',
  roomsTitle: 'Room directory',
  roomsHint: 'A new room opens once 9 slots fill',
  healthEvaluatedAt: 'Scored {time}',
  logFilterAll: 'All',
  logFilterWrite: 'Writes',
  logFilterIngest: 'Capture',
  logFilterRetrieve: 'Retrieval',
  logFilterOrganize: 'Organize',
  logCount: '{n} entries · both stores merged, newest first',
  benchTitle: 'Retrieval bench',
  drawerClose: 'Return',
  drawerTitle: 'Memory placard',
  kpiTotal: 'Memories',
  kpiActive: 'Open',
  kpiForgotten: 'Closed',
  kpiSignal: 'Clarity',
  opWrite: 'opened',
  opWriteMerge: 'merged in',
  opUpdate: 'renovated',
  opForget: 'closed',
  opRestore: 'reopened',
  opDecay: 'archived',
  opSuperseded: 'superseded',
  opIngestRequest: 'excavation requested',
  opIngestDone: 'excavated',
  opOutcomeReport: 'curator report',
  opAssess: 'evidence check',
  opConsolidation: 'consolidation',
  opReviewAnswer: 'review answer',
  opSlotAssign: 'slot assigned',
  opSlotBackfill: 'slots backfilled',
  opRoomOpen: 'room opened',
  consolidateArchived: 'archived {n}',
  consolidateMerged: 'merged {n}',
  consolidateSkipped: 'skipped {n}',
  decayArchived: 'archived {n}',
  slotBackfilled: '{n} slots assigned',
  roomOpened: 'opened room {room}',
  reviewAnswered: 'grade {grade} · next in {days}d',
  assessAdequate: 'evidence adequate',
  assessInadequate: 'evidence insufficient',
  assessRefs: '{n} refs',
  opSearchRewrite: 'route rewritten',
  opCompressRequest: 'placard compressed',
  opDistillRequest: 'rooms merged',
  selectAll: 'Select all on page',
  deselectAll: 'Deselect all',
  selectedCount: '{n} memories',
  batchForget: 'Close selected ({n})',
  batchForgetConfirm: 'Close {n} memories?',
  batchRestore: 'Reopen selected ({n})',
  clearSelection: 'Clear selection',
  sectionCorridor: 'Corridor overview',
  corridorEmpty: 'No memories yet — the bird’s-eye view appears after a few memories arrive.',
  corridorFailed: 'Failed to load corridor',
  corridorLoad: 'Loading corridor overview…',
  corridorAria: 'Corridor overview map',
  corridorSummary: '{nodes} memories · {edges} corridors',
  edgeSupersedes: 'supersedes',
  edgeContradicts: 'contradicts',
  edgeOther: 'related / supports / refines',
  healthLoading: 'Taking pulse…',
  teleFailed: 'Telemetry failed',
  teleLoading: 'Aggregating curator events…',
  teleGroupRecent: 'Last 7 days',
  telePrivacyHint: 'Local aggregation only · never transmitted',
  telePrivacyTip: 'All op_log and telemetry counters are aggregated in this process\u2019s SQLite only; nothing is sent to any external service. Clearing the plugin or restarting the host wipes the data.',
  teleWrites: 'Opened',
  teleIngest: 'Excavated',
  teleConsolidate: 'Consolidated',
  benchPlaceholder: 'Name a room by keyword or meaning…',
  benchRun: 'Walk',
  benchScopeAll: 'All palaces',
  benchHits: '{n} rooms found',
  benchDegraded: 'Beacon dark · keyword lane only',
  benchEmpty: 'No route found',
  benchNote: 'Walk uses the same map as the guided tour and counts as a visit',
  viaFts: 'keyword',
  viaVec: 'semantic',
  viaBoth: 'dual',
  viaEdgeLabel: 'corridor',
  benchRewrite: 'route split into {n}',
  benchCompress: 'compressed {n} overflow placards',
  activityEmpty: 'No curator activity yet',
  detailRevisions: 'Exhibit history',
  tourProposalTitle: 'Tour proposal',
  tourProposalEmpty: 'The palace is empty — place a first memory via engram_save',
  tourProposalHint: 'Click a memory to open its placard',
  tourFocusAll: 'All',
  refurbTitle: 'Refurb suggestions',
  refurbEmpty: 'All rooms are healthy — no suggestions',
  refurbRun: 'Re-scan',
  refurbActionDemote: 'demote',
  refurbActionMerge: 'merge',
  refurbActionReview: 'review',
  refurbActionSplit: 'split',
  refurbCount: '{n} suggestions',
  refurbExecute: 'Apply',
  refurbConfirmDemote: 'Demote this memory? Status will become archived; you can reopen it later.',
  refurbConfirmMerge: 'Merge {n} similar memories? This triggers engram_distill to fold them into one higher-level pattern.',
  refurbDemoteDone: 'Demoted',
  refurbMergeDone: 'Merge dispatched',
  refurbActionFailed: 'Action failed: {msg}',
  refurbMergeEmpty: 'No merge candidates',
  heroDue: 'Due today',
  filterDueToday: 'Due today',
  sortTime: 'By time',
  sortTour: 'By tour route',
  dueBadgeLabel: '{n} due today — click to filter in the library',
  tabBackfill: 'Backfill',
  backfillIntro: 'Distils past dsh sessions into the palace, turn by turn: each session is written into the project store matching its own cwd. Turns already captured are skipped by idempotency key, so starting again resumes where it stopped. Backfilled memories never enter the due-today queue.',
  backfillRulesTitle: 'Import rules',
  backfillDays: 'Time window',
  backfillDaysAll: 'All',
  backfillDaysUnit: '{n} days',
  backfillMaxTurns: 'Max turns per session',
  backfillMaxTotal: 'Total turn budget',
  backfillModel: 'Auxiliary model',
  backfillModelAuto: 'Auto (model currently in use)',
  backfillIncludeSubagents: 'Include subagent sessions',
  backfillIncludeSeeded: 'Include seeded sessions',
  backfillIncludeNoCwd: 'Include sessions without cwd (private palace only)',
  backfillReestimate: 'Re-estimate',
  backfillEstimateTitle: 'Estimate',
  backfillCandidates: '{n} candidate sessions',
  backfillPendingTurns: '{n} turns pending',
  backfillAlready: '{n} turns already captured',
  backfillSkippedDetail: 'Excluded: subagent {subagent} · seeded {seeded} · no cwd {noCwd} · outside window {tooOld} · unreadable {unreadable}',
  backfillTruncated: 'Candidates exceed the total turn budget: only the most recent sessions run this time — raise the budget or run in batches',
  backfillStart: 'Start backfill',
  backfillPause: 'Pause',
  backfillStateRunning: 'Running…',
  backfillStateDone: 'Finished',
  backfillStateCancelled: 'Stopped (start again to resume)',
  backfillStateFailed: 'Failed',
  backfillProgressSessions: 'Sessions {done}/{total}',
  backfillProgressTurns: 'Turns {done}/{total}',
  backfillWritten: '{n} memories written',
  backfillTurnsSkipped: '{n} turns skipped',
  backfillTurnsFailed: '{n} turns failed',
  backfillFailures: 'Failures',
  backfillEstimating: 'Estimating…',
  backfillSkipReasons: 'Skipped',
  backfillRouteHint: 'Failures are usually because the model a past session used is not available here: set provider/model in cordis.yml, or run one turn with the target model first (backfill reuses the model currently in use) and retry — finished turns are skipped automatically.',
  skipLowActivity: 'low activity',
  skipChitchat: 'chitchat',
  skipForbidden: 'capture forbidden',
  skipNoContent: 'no user content',
  skipAlready: 'already captured',
  skipNoTurn: 'no such turn',
  skipNoRoute: 'no route in log',
  skipUnparsable: 'unparsable output',
  opProfileEdit: 'profile revised',
  profileOpCreate: 'created v{to} · {chars} chars',
  profileOpEdit: 'edited v{from}→v{to} · {chars} chars',
  profileOpRollback: 'rolled back v{from}→v{to} (restored v{restored}) · {chars} chars',
  profileTitle: 'Curated profile block',
  profileEmpty: 'No curated profile yet',
  profileEmptyHint: 'Ask the agent to call engram_profile_edit in a session; once created it is injected ahead of the derived profile at session start.',
  profileCurrent: 'Current content · v{n}',
  profileHistory: 'Version history (newest first)',
  profileSourceEdit: 'edited',
  profileSourceRollback: 'rollback',
  profileDiffBase: 'Base version',
  profileDiffTarget: 'Compare version',
  profileDiffNone: 'The two versions are identical',
  profileLoadFailed: 'Failed to load profile',
  tabEpisodes: 'Episodes',
  episodeSince: 'From date',
  episodeUntil: 'To date',
  episodeSessionId: 'Session id (optional)',
  episodeApply: 'Apply',
  episodeReset: 'Reset',
  episodeHint: 'Browse experiences grouped by session; group heads carry a one-line summary generated at ingest. Click "Nearby" on an entry to see what else happened around that moment',
  episodeNoGroups: 'No episodes in this range',
  episodeNoSession: 'No session origin',
  episodeSummaryMissing: '(No summary yet for this session: run a history backfill to add one)',
  episodeEntries: '{n} episodes',
  episodeNearby: 'Nearby',
  episodeAroundTitle: 'Time proximity expansion',
  episodeAroundEmpty: 'No other episodes within the proximity window',
  episodeClose: 'Collapse',
  tabEntities: 'Entities',
  entityHint: 'People, projects, tools and concepts extracted from memories; open one to see every memory that mentions it',
  entityKindAll: 'All kinds',
  entityKindPerson: 'People',
  entityKindProject: 'Projects',
  entityKindTool: 'Tools',
  entityKindConcept: 'Concepts',
  entityKindOther: 'Other',
  entitySearchPlaceholder: 'Search names or aliases',
  entityCount: '{n} entities',
  entityMemories: '{n} linked memories',
  entityOpen: 'View',
  entityAliases: 'Aliases',
  entityNoMemories: 'No linked memories',
  entityEmpty: 'No entities in this palace yet; they appear after you save memories that mention them',
  factSection: 'Facts ({n})',
  factEmpty: 'No facts yet; facts extracted from memories during ingestion will appear here',
  factValid: 'active',
  factInvalid: 'superseded',
  tabJev: 'Jev',
  jevIntro: 'Jev System-One adjudication: three-way ruling (merge / accept / defer) for ambiguous memories before they are written, plus contradiction confirmation. The key is stored in the local data directory (0600 file) and takes effect immediately after saving, no restart; when Jev is unavailable the plugin falls back to the pure four-rule disposition.',
  jevEnabled: 'Enable Jev adjudication',
  jevStatusOn: 'Jev adjudication active',
  jevStatusOff: 'Jev adjudication inactive (pure rule-based dispositions)',
  jevApiKey: 'API key',
  jevApiKeyHint: 'Leave empty to keep the stored key; click "Clear stored key" to remove it (falls back to cordis.yml).',
  jevApiKeyUnset: 'not configured',
  jevClearKey: 'Clear stored key',
  jevKeyCleared: 'Panel key cleared; falling back to deployment config',
  jevBaseUrl: 'Endpoint',
  jevModel: 'Adjudication model',
  jevTimeoutMs: 'Timeout (ms, 1000-60000)',
  jevThresholdsTitle: 'Adjudication thresholds (advanced cordis.yml config, read-only here)',
  jevThresholdLine: 'same memory ≥{merge} · new memory ≤{accept} · contradiction ≥{contradict}',
  jevSave: 'Save',
  jevSaved: 'Saved; config takes effect immediately',
  jevLoadFailed: 'Failed to load',
  jevTest: 'Test connection',
  jevTestOk: 'Connection OK: {ms} ms, ping probability {p}',
  jevTestFail: 'Connection failed: {error}',
  jevObsTitle: 'Recent adjudications (this process, up to 50, cleared on restart)',
  jevObsEmpty: 'No records yet; they appear when Jev adjudicates a write after being enabled',
  jevObsLoadFailed: 'Failed to load adjudication records',
  jevObsSiteBand: 'band',
  jevObsSiteContradiction: 'contradiction',
  jevObsVerdictMerge: 'merge',
  jevObsVerdictAccept: 'accept',
  jevObsVerdictDefer: 'defer',
  jevObsVerdictConfirm: 'confirm',
  jevObsVerdictReject: 'reject',
  jevObsVerdictFallback: 'fallback',
  jevObsNoAnswer: 'no answer',
  jevObsErrorLine: 'error: {error}',
}

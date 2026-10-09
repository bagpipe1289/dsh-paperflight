import { createElement } from 'react'
import {
  Activity,
  Box,
  Brain,
  Database,
  FileText,
  HardDrive,
  Hash,
  Home,
  MessageSquare,
  Puzzle,
  Settings,
  Smile,
  LibraryBig,
  KanbanSquare,
  PanelsTopLeft,
  Store,
  Clock3,
  Settings2,
} from 'lucide-react'

import { createStreamlineIcon } from '@/components/ui/streamline-menu-icon'

import type { MenuIcon, MenuSection } from './types'

const HomeIcon = createStreamlineIcon('allergens-fish-remix', Home)
const ChatManagementIcon = createStreamlineIcon('chat-two-bubbles-oval-remix', MessageSquare)
const BotConfigIcon = createStreamlineIcon('page-setting-remix', Settings)
const ModelIcon = createStreamlineIcon('module-remix', Box)
const PromptIcon = createStreamlineIcon('script-1-remix', FileText)
const EmojiIcon = createStreamlineIcon('happy-face-remix', Smile)
const ExpressionIcon = createStreamlineIcon('chat-bubble-square-write-remix', MessageSquare)
const JargonIcon = createStreamlineIcon('sign-hashtag-solid', Hash)
const BehaviorIcon = createStreamlineIcon('cyborg-solid', Brain)
const KnowledgeIcon = createStreamlineIcon('user-sticker-square-remix', Database)
const PluginConfigIcon = createStreamlineIcon('application-add-remix', Puzzle)
const AdapterManagementIcon: MenuIcon = (props) => createElement(Clock3, props)
const PluginMarketIcon = createStreamlineIcon('store-2-solid', Store)
const McpIcon: MenuIcon = (props) => createElement(Settings2, props)
const DataTransferIcon: MenuIcon = (props) => createElement(HardDrive, props)
const ReplyEffectsIcon: MenuIcon = (props) => createElement(Activity, props)

export const menuSections: MenuSection[] = [
  {
    title: 'sidebar.groups.overview',
    items: [
      {
        icon: HomeIcon,
        label: 'sidebar.menu.home',
        path: '/',
        searchDescription: 'search.items.homeDesc',
      },
      { icon: ChatManagementIcon, label: 'sidebar.menu.chatManagement', path: '/chat-management' },
    ],
  },
  {
    title: 'sidebar.groups.botConfig',
    items: [
      {
        icon: BotConfigIcon,
        label: 'sidebar.menu.botMainConfig',
        path: '/config/bot',
        searchDescription: 'search.items.botConfigDesc',
      },
      {
        icon: ModelIcon,
        label: 'sidebar.menu.modelManagement',
        path: '/config/model',
        searchDescription: 'search.items.modelDesc',
        tourId: 'sidebar-model-management',
      },
      {
        icon: AdapterManagementIcon,
        label: '定时任务',
        path: '/adapter-management',
      },
    ],
  },
  {
    title: 'sidebar.groups.botResources',
    items: [
      {
        icon: (props)=>createElement(LibraryBig,props),
        label: '技能中心',
        path: '/resource/emoji',
        searchDescription: 'search.items.emojiDesc',
      },
      {
        icon: ExpressionIcon,
        label: 'sidebar.menu.agentPresets',
        path: '/model-presets',
        searchDescription: 'search.items.agentPresetsDesc',
      },
      {
        icon: (props)=>createElement(KanbanSquare,props),
        label: '任务看板',
        path: '/resource/jargon',
        searchDescription: 'search.items.jargonDesc',
      },
      {
        icon: BehaviorIcon,
        label: 'sidebar.menu.behaviorLearning',
        path: '/resource/behavior',
        searchDescription: 'search.items.behaviorLearningDesc',
        featureFlag: 'behaviorLearning',
      },
      {
        icon: KnowledgeIcon,
        label: 'sidebar.menu.knowledgeBase',
        path: '/resource/knowledge-base',
      },
    ],
  },
  {
    title: 'sidebar.groups.extensionsMonitor',
    items: [
      { icon: PluginConfigIcon, label: 'sidebar.menu.pluginConfig', path: '/plugin-config' },
      {
        icon: PluginMarketIcon,
        label: 'sidebar.menu.pluginMarket',
        path: '/plugins',
        searchDescription: 'search.items.pluginsDesc',
      },
      {icon:(props)=>createElement(PanelsTopLeft,props),label:'插件工作台',path:'/plugin-workbench'},
      { icon: McpIcon, label: 'sidebar.menu.mcpSettings', path: '/mcp-settings' },
    ],
  },
  {
    title: 'sidebar.groups.advancedTools',
    items: [
      { icon: PromptIcon, label: 'sidebar.menu.promptManagement', path: '/config/prompts' },
      {
        icon: ReplyEffectsIcon,
        label: 'sidebar.menu.replyEffects',
        path: '/reply-effects',
        featureFlag: 'replyEffects',
      },
      {
        icon: DataTransferIcon,
        label: 'sidebar.menu.dataTransfer',
        path: '/data-transfer',
        searchDescription: 'search.items.dataTransferDesc',
      },
    ],
  },
]

// Domain Metadata and Configurations
export const DOMAINS = {
  projects: {
    id: 'projects',
    name: 'Projects',
    color: '#3B82F6', // Cobalt Blue
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    badgeClass: 'domain-projects',
    iconName: 'FolderGit2',
    description: 'Software, infrastructure, or product engineering milestones'
  },
  academic: {
    id: 'academic',
    name: 'Academic Works',
    color: '#10B981', // Emerald Green
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    badgeClass: 'domain-academic',
    iconName: 'BookOpen',
    description: 'Research papers, thesis drafting, literature reviews & lab assignments'
  },
  events: {
    id: 'events',
    name: 'Events',
    color: '#F59E0B', // Amber Gold
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    badgeClass: 'domain-events',
    iconName: 'Calendar',
    description: 'Deadlines, thesis defense dates, symposiums & milestones'
  },
  teams: {
    id: 'teams',
    name: 'Teams',
    color: '#8B5CF6', // Deep Purple
    textColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    badgeClass: 'domain-teams',
    iconName: 'Users',
    description: 'Cross-functional groups, research peers & workforce allocation'
  },
  other: {
    id: 'other',
    name: 'Other',
    color: '#71717A', // Cool Zinc Gray
    textColor: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/30',
    badgeClass: 'domain-other',
    iconName: 'FileText',
    description: 'Quick-capture tasks, compliance, legal & licensing items'
  }
};

export const STATUSES = {
  backlog: { id: 'backlog', label: 'Backlog', color: '#6B7280', badgeBg: 'bg-zinc-800', badgeText: 'text-zinc-400' },
  todo: { id: 'todo', label: 'To Do', color: '#9CA3AF', badgeBg: 'bg-zinc-700/50', badgeText: 'text-zinc-300' },
  in_progress: { id: 'in_progress', label: 'In Progress', color: '#3B82F6', badgeBg: 'bg-blue-950/60', badgeText: 'text-blue-400' },
  in_review: { id: 'in_review', label: 'In Review', color: '#8B5CF6', badgeBg: 'bg-purple-950/60', badgeText: 'text-purple-400' },
  done: { id: 'done', label: 'Done', color: '#10B981', badgeBg: 'bg-emerald-950/60', badgeText: 'text-emerald-400' }
};

export const PRIORITIES = {
  urgent: { id: 'urgent', label: 'Urgent', rank: 4, color: '#EF4444', icon: 'AlertTriangle' },
  high: { id: 'high', label: 'High', rank: 3, color: '#F97316', icon: 'SignalHigh' },
  medium: { id: 'medium', label: 'Medium', rank: 2, color: '#EAB308', icon: 'SignalMedium' },
  low: { id: 'low', label: 'Low', rank: 1, color: '#3B82F6', icon: 'SignalLow' },
  none: { id: 'none', label: 'None', rank: 0, color: '#6B7280', icon: 'Minus' }
};

// No static data. The backend Excel workbook (workspace_data.xlsx) is the single
// source of truth. All items, assignees, and profile data are created by the user
// and persisted to the server — nothing is hard-coded or seeded here.

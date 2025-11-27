'use client';

import { useState } from 'react';
import Link from 'next/link';

// ============================================================================
// Types & Sample Data
// ============================================================================

interface CABMember {
  id: string;
  name: string;
  company: string;
  role: string;
  avatar: string;
  joinedAt: string;
  participationScore: number;
}

interface FeedbackItem {
  id: string;
  memberId: string;
  memberName: string;
  memberCompany: string;
  memberAvatar: string;
  type: 'feature_request' | 'bug_report' | 'praise' | 'question';
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'in_review' | 'planned' | 'shipped';
  title: string;
  description: string;
  votes: number;
  createdAt: string;
}

interface CABSession {
  id: string;
  title: string;
  date: string;
  status: 'upcoming' | 'completed';
  attendees: number;
  topics: string[];
  insights: number;
}

const DEMO_MEMBERS: CABMember[] = [
  { id: 'm1', name: 'María García', company: 'TechCorp MX', role: 'CTO', avatar: '👩‍💼', joinedAt: '2024-01-15', participationScore: 95 },
  { id: 'm2', name: 'Carlos Mendoza', company: 'InnovateLab', role: 'Product Director', avatar: '👨‍💻', joinedAt: '2024-02-01', participationScore: 88 },
  { id: 'm3', name: 'Ana Rodríguez', company: 'FinServ Plus', role: 'VP Engineering', avatar: '👩‍🔬', joinedAt: '2024-01-20', participationScore: 92 },
  { id: 'm4', name: 'Luis Hernández', company: 'DataDriven Co', role: 'Head of Product', avatar: '👨‍🎨', joinedAt: '2024-03-10', participationScore: 75 },
  { id: 'm5', name: 'Sofia Martínez', company: 'CloudScale', role: 'Engineering Manager', avatar: '👩‍🚀', joinedAt: '2024-02-15', participationScore: 82 },
];

const DEMO_FEEDBACK: FeedbackItem[] = [
  {
    id: 'f1', memberId: 'm1', memberName: 'María García', memberCompany: 'TechCorp MX', memberAvatar: '👩‍💼',
    type: 'feature_request', priority: 'high', status: 'planned',
    title: 'API Webhooks for Real-time Notifications',
    description: 'We need webhook support to integrate with our internal alerting system. Currently polling the API every 5 minutes which is inefficient.',
    votes: 12, createdAt: '2024-10-15',
  },
  {
    id: 'f2', memberId: 'm2', memberName: 'Carlos Mendoza', memberCompany: 'InnovateLab', memberAvatar: '👨‍💻',
    type: 'feature_request', priority: 'high', status: 'in_review',
    title: 'SSO Integration with SAML 2.0',
    description: 'Enterprise customers require SAML-based SSO. This is blocking our expansion to larger accounts.',
    votes: 8, createdAt: '2024-10-20',
  },
  {
    id: 'f3', memberId: 'm3', memberName: 'Ana Rodríguez', memberCompany: 'FinServ Plus', memberAvatar: '👩‍🔬',
    type: 'bug_report', priority: 'medium', status: 'shipped',
    title: 'Dashboard loading slow with 1000+ records',
    description: 'Performance degrades significantly when viewing dashboards with large datasets. Need pagination or virtualization.',
    votes: 5, createdAt: '2024-10-10',
  },
  {
    id: 'f4', memberId: 'm4', memberName: 'Luis Hernández', memberCompany: 'DataDriven Co', memberAvatar: '👨‍🎨',
    type: 'praise', priority: 'low', status: 'new',
    title: 'Love the new analytics dashboard!',
    description: 'The recent update to the analytics section is fantastic. Much cleaner UI and the export functionality is exactly what we needed.',
    votes: 15, createdAt: '2024-11-01',
  },
  {
    id: 'f5', memberId: 'm5', memberName: 'Sofia Martínez', memberCompany: 'CloudScale', memberAvatar: '👩‍🚀',
    type: 'question', priority: 'medium', status: 'new',
    title: 'Best practices for team onboarding?',
    description: 'We\'re onboarding 50 new users next month. What\'s the recommended approach for bulk user provisioning and training?',
    votes: 3, createdAt: '2024-11-05',
  },
];

const DEMO_SESSIONS: CABSession[] = [
  { id: 's1', title: 'Q4 Roadmap Review', date: '2024-11-15', status: 'upcoming', attendees: 8, topics: ['Roadmap', 'Prioritization', 'Enterprise Features'], insights: 0 },
  { id: 's2', title: 'Integration Deep-Dive', date: '2024-10-20', status: 'completed', attendees: 6, topics: ['APIs', 'Webhooks', 'Third-party'], insights: 12 },
  { id: 's3', title: 'UX Feedback Session', date: '2024-09-15', status: 'completed', attendees: 10, topics: ['Dashboard', 'Mobile', 'Onboarding'], insights: 18 },
];

const TYPE_COLORS = {
  feature_request: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Feature Request', icon: '💡' },
  bug_report: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Bug Report', icon: '🐛' },
  praise: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Praise', icon: '⭐' },
  question: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Question', icon: '❓' },
};

const STATUS_COLORS = {
  new: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
  in_review: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  planned: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  shipped: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
};

const DEMO_INTERACTION_LIMIT = 5;

// ============================================================================
// Components
// ============================================================================

function StatCard({ label, value, icon, trend }: { label: string; value: string | number; icon: string; trend?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {trend && <p className="text-xs text-green-600 dark:text-green-400 mt-1">{trend}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: CABMember }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      <span className="text-2xl">{member.avatar}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{member.role} @ {member.company}</p>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{member.participationScore}%</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">engagement</div>
      </div>
    </div>
  );
}

function FeedbackCard({ item, onVote }: { item: FeedbackItem; onVote: () => void }) {
  const typeStyle = TYPE_COLORS[item.type];
  const statusStyle = STATUS_COLORS[item.status];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
      <div className="flex items-start gap-3">
        <button
          onClick={onVote}
          className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-lg">▲</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{item.votes}</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
              {typeStyle.icon} {typeStyle.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
              {item.status.replace('_', ' ')}
            </span>
            {item.priority === 'high' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                🔥 High Priority
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{item.description}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{item.memberAvatar}</span>
            <span>{item.memberName}</span>
            <span>•</span>
            <span>{item.memberCompany}</span>
            <span>•</span>
            <span>{item.createdAt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: CABSession }) {
  const isUpcoming = session.status === 'upcoming';

  return (
    <div className={`rounded-xl p-4 border ${isUpcoming ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{session.title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isUpcoming ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
          {isUpcoming ? '📅 Upcoming' : '✅ Completed'}
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{session.date}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {session.topics.map((topic) => (
          <span key={topic} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
            {topic}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>👥 {session.attendees} attendees</span>
        {session.insights > 0 && <span>💡 {session.insights} insights</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Main Demo Page
// ============================================================================

export default function CoformaStudioDemo() {
  const [activeTab, setActiveTab] = useState<'overview' | 'feedback' | 'members' | 'sessions'>('overview');
  const [feedback, setFeedback] = useState(DEMO_FEEDBACK);
  const [interactionsUsed, setInteractionsUsed] = useState(0);
  const [showUpsell, setShowUpsell] = useState(false);

  const handleVote = (feedbackId: string) => {
    if (interactionsUsed >= DEMO_INTERACTION_LIMIT) {
      setShowUpsell(true);
      return;
    }

    setFeedback((prev) =>
      prev.map((f) => (f.id === feedbackId ? { ...f, votes: f.votes + 1 } : f))
    );
    setInteractionsUsed((prev) => prev + 1);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'sessions', label: 'Sessions', icon: '📅' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
              C
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-900 dark:text-white">Coforma Studio</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Interactive Demo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-full">
              Demo Mode: {DEMO_INTERACTION_LIMIT - interactionsUsed} interactions left
            </span>
            <Link
              href="/auth/signup"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all"
            >
              Start Free Trial →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Customer Advisory Board Platform
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Transform customer feedback into product decisions. Explore our sample CAB with
            real-world data to see how Coforma Studio streamlines customer collaboration.
          </p>
        </div>

        {/* Demo CAB Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm mb-1">Sample Advisory Board</p>
              <h2 className="text-2xl font-bold">Acme Product CAB</h2>
              <p className="text-blue-100 mt-1">Enterprise SaaS Product Advisory Board</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{DEMO_MEMBERS.length}</div>
              <div className="text-blue-200 text-sm">Active Members</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Feedback" value={feedback.length} icon="💬" trend="+23% this month" />
              <StatCard label="Avg Engagement" value="87%" icon="📈" trend="+5% vs last quarter" />
              <StatCard label="Sessions Held" value={DEMO_SESSIONS.length} icon="📅" />
              <StatCard label="Insights Captured" value="30" icon="💡" />
            </div>

            {/* Quick Views */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Feedback */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Feedback</h3>
                <div className="space-y-3">
                  {feedback.slice(0, 3).map((item) => (
                    <FeedbackCard key={item.id} item={item} onVote={() => handleVote(item.id)} />
                  ))}
                </div>
              </div>

              {/* Top Members */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Top Engaged Members</h3>
                <div className="space-y-2">
                  {DEMO_MEMBERS.sort((a, b) => b.participationScore - a.participationScore)
                    .slice(0, 4)
                    .map((member) => (
                      <MemberCard key={member.id} member={member} />
                    ))}
                </div>
              </div>
            </div>

            {/* Upcoming Session */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Next Session</h3>
              <SessionCard session={DEMO_SESSIONS[0]} />
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">All Feedback ({feedback.length})</h3>
              <div className="flex gap-2">
                <select className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option>All Types</option>
                  <option>Feature Requests</option>
                  <option>Bug Reports</option>
                  <option>Questions</option>
                </select>
                <select className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option>Most Voted</option>
                  <option>Newest</option>
                  <option>High Priority</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              {feedback.map((item) => (
                <FeedbackCard key={item.id} item={item} onVote={() => handleVote(item.id)} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">CAB Members ({DEMO_MEMBERS.length})</h3>
              <button
                onClick={() => setShowUpsell(true)}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium text-sm"
              >
                + Invite Member
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {DEMO_MEMBERS.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">CAB Sessions</h3>
              <button
                onClick={() => setShowUpsell(true)}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium text-sm"
              >
                + Schedule Session
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {DEMO_SESSIONS.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-800">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Ready to build with your customers?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
              Coforma Studio helps product teams capture, prioritize, and act on customer feedback.
              Start your free 14-day trial today.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/auth/signup"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all"
              >
                Start Free Trial
              </Link>
              <button className="px-6 py-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Book a Demo
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Upsell Modal */}
      {showUpsell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                C
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {interactionsUsed >= DEMO_INTERACTION_LIMIT ? 'Demo Complete!' : 'Create Your CAB'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {interactionsUsed >= DEMO_INTERACTION_LIMIT
                  ? 'You\'ve explored the demo! Sign up to create your own Customer Advisory Board.'
                  : 'Start your free trial to invite members, schedule sessions, and collect feedback.'}
              </p>

              <div className="space-y-3 text-left mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Unlimited CAB members</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Session scheduling & recording</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Feedback voting & prioritization</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">AI-powered insight extraction</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Integrations with Jira, Linear, Notion</span>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/auth/signup"
                  className="block w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all text-center"
                >
                  Start 14-Day Free Trial →
                </Link>
                <button
                  onClick={() => setShowUpsell(false)}
                  className="w-full py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                >
                  Continue Exploring Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

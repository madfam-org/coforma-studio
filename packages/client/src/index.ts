/**
 * @coforma/client
 *
 * Coforma Studio SDK - Customer Advisory Board integration for MADFAM products
 *
 * This SDK enables any MADFAM product to:
 * - Collect structured customer feedback
 * - Track feature requests and ideas from CAB members
 * - Display product roadmap influenced by CAB insights
 * - Manage CAB member engagement and recognition
 */

// ============================================================================
// Types & Enums
// ============================================================================

export type TenantRole = 'ADMIN' | 'FACILITATOR' | 'MEMBER';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type FeedbackType = 'IDEA' | 'BUG' | 'REQUEST' | 'RESEARCH_INSIGHT';
export type FeedbackStatus = 'OPEN' | 'UNDER_REVIEW' | 'PLANNED' | 'IN_PROGRESS' | 'SHIPPED' | 'CLOSED';
export type FeedbackPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BadgeType = 'FOUNDING_PARTNER' | 'INFLUENCER' | 'TOP_CONTRIBUTOR' | 'EARLY_ADOPTER' | 'POWER_USER' | 'STRATEGIC_ADVISOR';

export interface CoformaConfig {
  baseUrl: string;
  apiKey: string;
  tenantId: string;
  productId: string; // Which MADFAM product is integrating
  timeout?: number;
}

// ============================================================================
// Core Entities
// ============================================================================

export interface CAB {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  purpose: string | null;
  memberCount: number;
  isActive: boolean;
  settings: CABSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CABSettings {
  maxMembers: number;
  sessionFrequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  feedbackVisibility: 'private' | 'cab_only' | 'public';
  allowAnonymousFeedback: boolean;
  requireNDA: boolean;
}

export interface CABMember {
  id: string;
  cabId: string;
  userId: string;
  email: string;
  name: string;
  company: string | null;
  role: string | null;
  joinedAt: string;
  engagementScore: number;
  badges: Badge[];
  stats: MemberStats;
}

export interface MemberStats {
  sessionsAttended: number;
  feedbackSubmitted: number;
  ideasContributed: number;
  referralsMade: number;
  lastActiveAt: string | null;
}

export interface Badge {
  id: string;
  type: BadgeType;
  name: string;
  description: string;
  awardedAt: string;
  isPublic: boolean;
}

// ============================================================================
// Feedback & Roadmap
// ============================================================================

export interface Feedback {
  id: string;
  cabId: string;
  memberId: string;
  memberName: string;
  type: FeedbackType;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  title: string;
  description: string;
  productArea: string | null;
  linkedRoadmapItemId: string | null;
  votes: number;
  hasVoted?: boolean; // Current user's vote status
  isAnonymous: boolean;
  attachments: Attachment[];
  comments: Comment[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string | null;
}

export interface RoadmapItem {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: 'BACKLOG' | 'PLANNED' | 'IN_PROGRESS' | 'SHIPPED';
  quarter: string | null; // e.g., "Q1 2025"
  productArea: string;
  linkedFeedbackCount: number;
  cabInfluenceScore: number; // How much CAB feedback influenced this
  isPublic: boolean;
  releaseDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

// ============================================================================
// Sessions & Engagement
// ============================================================================

export interface Session {
  id: string;
  cabId: string;
  title: string;
  description: string | null;
  status: SessionStatus;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string | null;
  agenda: AgendaItem[];
  attendeeCount: number;
  recordingUrl: string | null;
  summaryNotes: string | null;
  createdAt: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  presenter: string | null;
  order: number;
}

export interface SessionAttendance {
  sessionId: string;
  memberId: string;
  status: 'INVITED' | 'CONFIRMED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
  joinedAt: string | null;
  leftAt: string | null;
}

// ============================================================================
// Analytics & Insights
// ============================================================================

export interface CABInsights {
  cabId: string;
  period: string; // e.g., "last_30_days"
  memberEngagement: {
    activeMembers: number;
    totalMembers: number;
    engagementRate: number;
    avgSessionAttendance: number;
  };
  feedbackMetrics: {
    totalFeedback: number;
    byType: Record<FeedbackType, number>;
    byStatus: Record<FeedbackStatus, number>;
    avgTimeToResponse: number; // hours
    implementationRate: number; // % of feedback that became shipped features
  };
  topContributors: Array<{
    memberId: string;
    memberName: string;
    feedbackCount: number;
    engagementScore: number;
  }>;
  trendingTopics: Array<{
    topic: string;
    mentions: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  productImpact: {
    featuresInfluenced: number;
    roadmapItemsCreated: number;
    revenueAttributed: number | null;
  };
}

export interface ProductFeedbackSummary {
  productId: string;
  productName: string;
  totalFeedback: number;
  openItems: number;
  plannedItems: number;
  shippedItems: number;
  topRequests: Array<{
    id: string;
    title: string;
    votes: number;
    status: FeedbackStatus;
  }>;
  recentFeedback: Feedback[];
}

// ============================================================================
// Client Implementation
// ============================================================================

export class CoformaClient {
  private baseUrl: string;
  private apiKey: string;
  private tenantId: string;
  private productId: string;
  private timeout: number;

  constructor(config: CoformaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.tenantId = config.tenantId;
    this.productId = config.productId;
    this.timeout = config.timeout || 10000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Tenant-ID': this.tenantId,
          'X-Product-ID': this.productId,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -------------------------------------------------------------------------
  // CAB Management
  // -------------------------------------------------------------------------

  async getCABs(): Promise<CAB[]> {
    return this.request<CAB[]>('GET', '/api/v1/cabs');
  }

  async getCAB(cabId: string): Promise<CAB> {
    return this.request<CAB>('GET', `/api/v1/cabs/${cabId}`);
  }

  async getCABMembers(cabId: string): Promise<CABMember[]> {
    return this.request<CABMember[]>('GET', `/api/v1/cabs/${cabId}/members`);
  }

  async getCABInsights(cabId: string, period?: string): Promise<CABInsights> {
    const query = period ? `?period=${period}` : '';
    return this.request<CABInsights>('GET', `/api/v1/cabs/${cabId}/insights${query}`);
  }

  // -------------------------------------------------------------------------
  // Feedback Operations
  // -------------------------------------------------------------------------

  async getFeedback(cabId: string, filters?: {
    type?: FeedbackType;
    status?: FeedbackStatus;
    productArea?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Feedback[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.productArea) params.append('productArea', filters.productArea);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/api/v1/cabs/${cabId}/feedback${query}`);
  }

  async getFeedbackItem(feedbackId: string): Promise<Feedback> {
    return this.request<Feedback>('GET', `/api/v1/feedback/${feedbackId}`);
  }

  async submitFeedback(cabId: string, feedback: {
    type: FeedbackType;
    title: string;
    description: string;
    productArea?: string;
    isAnonymous?: boolean;
    tags?: string[];
  }): Promise<Feedback> {
    return this.request<Feedback>('POST', `/api/v1/cabs/${cabId}/feedback`, {
      ...feedback,
      sourceProduct: this.productId,
    });
  }

  async voteFeedback(feedbackId: string, vote: 1 | -1 | 0): Promise<{ votes: number }> {
    return this.request('POST', `/api/v1/feedback/${feedbackId}/vote`, { vote });
  }

  async commentOnFeedback(feedbackId: string, content: string): Promise<Comment> {
    return this.request<Comment>('POST', `/api/v1/feedback/${feedbackId}/comments`, { content });
  }

  // -------------------------------------------------------------------------
  // Product-Specific Feedback (for embedding in MADFAM products)
  // -------------------------------------------------------------------------

  async getProductFeedbackSummary(): Promise<ProductFeedbackSummary> {
    return this.request<ProductFeedbackSummary>('GET', `/api/v1/products/${this.productId}/feedback-summary`);
  }

  async submitProductFeedback(feedback: {
    type: FeedbackType;
    title: string;
    description: string;
    productArea?: string;
    context?: Record<string, unknown>; // Product-specific context (page, feature, etc.)
  }): Promise<Feedback> {
    return this.request<Feedback>('POST', `/api/v1/products/${this.productId}/feedback`, feedback);
  }

  async getProductRoadmap(options?: {
    status?: RoadmapItem['status'];
    productArea?: string;
    publicOnly?: boolean;
  }): Promise<RoadmapItem[]> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.productArea) params.append('productArea', options.productArea);
    if (options?.publicOnly) params.append('publicOnly', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<RoadmapItem[]>('GET', `/api/v1/products/${this.productId}/roadmap${query}`);
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async getUpcomingSessions(cabId: string): Promise<Session[]> {
    return this.request<Session[]>('GET', `/api/v1/cabs/${cabId}/sessions?status=SCHEDULED`);
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>('GET', `/api/v1/sessions/${sessionId}`);
  }

  async rsvpSession(sessionId: string, response: 'CONFIRMED' | 'CANCELLED'): Promise<SessionAttendance> {
    return this.request<SessionAttendance>('POST', `/api/v1/sessions/${sessionId}/rsvp`, { response });
  }

  // -------------------------------------------------------------------------
  // Member Profile
  // -------------------------------------------------------------------------

  async getCurrentMember(): Promise<CABMember | null> {
    try {
      return await this.request<CABMember>('GET', '/api/v1/me/cab-profile');
    } catch {
      return null; // User might not be a CAB member
    }
  }

  async getMemberBadges(): Promise<Badge[]> {
    return this.request<Badge[]>('GET', '/api/v1/me/badges');
  }

  async getMemberActivity(): Promise<{
    recentFeedback: Feedback[];
    upcomingSessions: Session[];
    stats: MemberStats;
  }> {
    return this.request('GET', '/api/v1/me/cab-activity');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getFeedbackStatusLabel(status: FeedbackStatus): string {
  const labels: Record<FeedbackStatus, string> = {
    OPEN: 'Open',
    UNDER_REVIEW: 'Under Review',
    PLANNED: 'Planned',
    IN_PROGRESS: 'In Progress',
    SHIPPED: 'Shipped',
    CLOSED: 'Closed',
  };
  return labels[status];
}

export function getFeedbackStatusColor(status: FeedbackStatus): string {
  const colors: Record<FeedbackStatus, string> = {
    OPEN: '#6B7280',      // gray
    UNDER_REVIEW: '#F59E0B', // amber
    PLANNED: '#3B82F6',   // blue
    IN_PROGRESS: '#8B5CF6', // purple
    SHIPPED: '#10B981',   // green
    CLOSED: '#9CA3AF',    // gray-light
  };
  return colors[status];
}

export function getFeedbackTypeIcon(type: FeedbackType): string {
  const icons: Record<FeedbackType, string> = {
    IDEA: '💡',
    BUG: '🐛',
    REQUEST: '✨',
    RESEARCH_INSIGHT: '🔍',
  };
  return icons[type];
}

export function getBadgeIcon(type: BadgeType): string {
  const icons: Record<BadgeType, string> = {
    FOUNDING_PARTNER: '🏆',
    INFLUENCER: '⭐',
    TOP_CONTRIBUTOR: '🎯',
    EARLY_ADOPTER: '🚀',
    POWER_USER: '💪',
    STRATEGIC_ADVISOR: '🧠',
  };
  return icons[type];
}

export function formatEngagementScore(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Low';
  return 'Inactive';
}

export function getEngagementScoreColor(score: number): string {
  if (score >= 90) return '#10B981'; // green
  if (score >= 70) return '#3B82F6'; // blue
  if (score >= 50) return '#F59E0B'; // amber
  if (score >= 30) return '#F97316'; // orange
  return '#EF4444'; // red
}

// Default export
export default CoformaClient;

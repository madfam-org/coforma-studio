/**
 * @coforma/client/react
 *
 * React hooks and components for Coforma Studio integration
 * Enables MADFAM products to easily embed CAB functionality
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  CoformaClient,
  type CoformaConfig,
  type CAB,
  type CABMember,
  type CABInsights,
  type Feedback,
  type FeedbackType,
  type FeedbackStatus,
  type RoadmapItem,
  type Session,
  type ProductFeedbackSummary,
  type Badge,
  type MemberStats,
  getFeedbackStatusLabel,
  getFeedbackStatusColor,
  getFeedbackTypeIcon,
  getBadgeIcon,
  formatEngagementScore,
  getEngagementScoreColor,
} from './index';

// ============================================================================
// Context
// ============================================================================

interface CoformaContextValue {
  client: CoformaClient;
  isCABMember: boolean;
  currentMember: CABMember | null;
  productId: string;
}

const CoformaContext = createContext<CoformaContextValue | null>(null);

export interface CoformaProviderProps {
  config: CoformaConfig;
  children: ReactNode;
}

export function CoformaProvider({ config, children }: CoformaProviderProps) {
  const [currentMember, setCurrentMember] = useState<CABMember | null>(null);
  const [isCABMember, setIsCABMember] = useState(false);

  const client = useMemo(() => new CoformaClient(config), [config]);

  useEffect(() => {
    client.getCurrentMember().then((member) => {
      setCurrentMember(member);
      setIsCABMember(member !== null);
    });
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      isCABMember,
      currentMember,
      productId: config.productId,
    }),
    [client, isCABMember, currentMember, config.productId]
  );

  return (
    <CoformaContext.Provider value={value}>
      {children}
    </CoformaContext.Provider>
  );
}

export function useCoforma(): CoformaContextValue {
  const context = useContext(CoformaContext);
  if (!context) {
    throw new Error('useCoforma must be used within a CoformaProvider');
  }
  return context;
}

// ============================================================================
// Feedback Hooks
// ============================================================================

interface UseFeedbackOptions {
  cabId?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
  productArea?: string;
  limit?: number;
}

interface UseFeedbackResult {
  feedback: Feedback[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useFeedback(options: UseFeedbackOptions = {}): UseFeedbackResult {
  const { client } = useCoforma();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = options.limit || 20;

  const fetchFeedback = useCallback(async (reset = false) => {
    if (!options.cabId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      const result = await client.getFeedback(options.cabId, {
        type: options.type,
        status: options.status,
        productArea: options.productArea,
        limit,
        offset: currentOffset,
      });

      if (reset) {
        setFeedback(result.items);
        setOffset(limit);
      } else {
        setFeedback(prev => [...prev, ...result.items]);
        setOffset(prev => prev + limit);
      }
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch feedback'));
    } finally {
      setLoading(false);
    }
  }, [client, options.cabId, options.type, options.status, options.productArea, limit, offset]);

  useEffect(() => {
    fetchFeedback(true);
  }, [options.cabId, options.type, options.status, options.productArea]);

  return {
    feedback,
    total,
    loading,
    error,
    refetch: () => fetchFeedback(true),
    loadMore: () => fetchFeedback(false),
    hasMore: feedback.length < total,
  };
}

interface UseProductFeedbackResult {
  summary: ProductFeedbackSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProductFeedback(): UseProductFeedbackResult {
  const { client } = useCoforma();
  const [summary, setSummary] = useState<ProductFeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.getProductFeedbackSummary();
      setSummary(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch feedback summary'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

interface UseSubmitFeedbackResult {
  submit: (feedback: {
    type: FeedbackType;
    title: string;
    description: string;
    productArea?: string;
    context?: Record<string, unknown>;
  }) => Promise<Feedback>;
  submitting: boolean;
  error: Error | null;
}

export function useSubmitFeedback(): UseSubmitFeedbackResult {
  const { client } = useCoforma();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async (feedback: {
    type: FeedbackType;
    title: string;
    description: string;
    productArea?: string;
    context?: Record<string, unknown>;
  }) => {
    try {
      setSubmitting(true);
      setError(null);
      const result = await client.submitProductFeedback(feedback);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit feedback');
      setError(error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [client]);

  return { submit, submitting, error };
}

interface UseVoteFeedbackResult {
  vote: (feedbackId: string, vote: 1 | -1 | 0) => Promise<{ votes: number }>;
  voting: boolean;
  error: Error | null;
}

export function useVoteFeedback(): UseVoteFeedbackResult {
  const { client } = useCoforma();
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vote = useCallback(async (feedbackId: string, voteValue: 1 | -1 | 0) => {
    try {
      setVoting(true);
      setError(null);
      return await client.voteFeedback(feedbackId, voteValue);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to vote');
      setError(error);
      throw error;
    } finally {
      setVoting(false);
    }
  }, [client]);

  return { vote, voting, error };
}

// ============================================================================
// Roadmap Hooks
// ============================================================================

interface UseRoadmapOptions {
  status?: RoadmapItem['status'];
  productArea?: string;
  publicOnly?: boolean;
}

interface UseRoadmapResult {
  roadmap: RoadmapItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRoadmap(options: UseRoadmapOptions = {}): UseRoadmapResult {
  const { client } = useCoforma();
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRoadmap = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.getProductRoadmap(options);
      setRoadmap(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch roadmap'));
    } finally {
      setLoading(false);
    }
  }, [client, options.status, options.productArea, options.publicOnly]);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  return { roadmap, loading, error, refetch: fetchRoadmap };
}

// ============================================================================
// CAB Hooks
// ============================================================================

interface UseCABResult {
  cab: CAB | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCAB(cabId: string): UseCABResult {
  const { client } = useCoforma();
  const [cab, setCab] = useState<CAB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCAB = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.getCAB(cabId);
      setCab(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch CAB'));
    } finally {
      setLoading(false);
    }
  }, [client, cabId]);

  useEffect(() => {
    fetchCAB();
  }, [fetchCAB]);

  return { cab, loading, error, refetch: fetchCAB };
}

interface UseCABInsightsResult {
  insights: CABInsights | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCABInsights(cabId: string, period?: string): UseCABInsightsResult {
  const { client } = useCoforma();
  const [insights, setInsights] = useState<CABInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.getCABInsights(cabId, period);
      setInsights(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch insights'));
    } finally {
      setLoading(false);
    }
  }, [client, cabId, period]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { insights, loading, error, refetch: fetchInsights };
}

// ============================================================================
// Session Hooks
// ============================================================================

interface UseSessionsResult {
  sessions: Session[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUpcomingSessions(cabId: string): UseSessionsResult {
  const { client } = useCoforma();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.getUpcomingSessions(cabId);
      setSessions(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch sessions'));
    } finally {
      setLoading(false);
    }
  }, [client, cabId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}

interface UseRSVPResult {
  rsvp: (sessionId: string, response: 'CONFIRMED' | 'CANCELLED') => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useRSVP(): UseRSVPResult {
  const { client } = useCoforma();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const rsvp = useCallback(async (sessionId: string, response: 'CONFIRMED' | 'CANCELLED') => {
    try {
      setLoading(true);
      setError(null);
      await client.rsvpSession(sessionId, response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to RSVP');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [client]);

  return { rsvp, loading, error };
}

// ============================================================================
// Member Hooks
// ============================================================================

interface UseMemberProfileResult {
  member: CABMember | null;
  isCABMember: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMemberProfile(): UseMemberProfileResult {
  const { currentMember, isCABMember, client } = useCoforma();
  const [member, setMember] = useState<CABMember | null>(currentMember);
  const [loading, setLoading] = useState(!currentMember);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.getCurrentMember();
      setMember(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch member profile'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!currentMember) {
      refetch();
    } else {
      setMember(currentMember);
      setLoading(false);
    }
  }, [currentMember, refetch]);

  return { member, isCABMember, loading, error, refetch };
}

interface UseMemberBadgesResult {
  badges: Badge[];
  loading: boolean;
  error: Error | null;
}

export function useMemberBadges(): UseMemberBadgesResult {
  const { client } = useCoforma();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    client.getMemberBadges()
      .then((result) => {
        setBadges(result);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to fetch badges'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [client]);

  return { badges, loading, error };
}

interface UseMemberActivityResult {
  recentFeedback: Feedback[];
  upcomingSessions: Session[];
  stats: MemberStats | null;
  loading: boolean;
  error: Error | null;
}

export function useMemberActivity(): UseMemberActivityResult {
  const { client } = useCoforma();
  const [activity, setActivity] = useState<{
    recentFeedback: Feedback[];
    upcomingSessions: Session[];
    stats: MemberStats | null;
  }>({
    recentFeedback: [],
    upcomingSessions: [],
    stats: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    client.getMemberActivity()
      .then((result) => {
        setActivity(result);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to fetch activity'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [client]);

  return { ...activity, loading, error };
}

// ============================================================================
// Display Utilities (as hooks for consistency)
// ============================================================================

export function useFeedbackDisplay(feedback: Feedback) {
  return useMemo(() => ({
    statusLabel: getFeedbackStatusLabel(feedback.status),
    statusColor: getFeedbackStatusColor(feedback.status),
    typeIcon: getFeedbackTypeIcon(feedback.type),
  }), [feedback.status, feedback.type]);
}

export function useBadgeDisplay(badge: Badge) {
  return useMemo(() => ({
    icon: getBadgeIcon(badge.type),
  }), [badge.type]);
}

export function useEngagementDisplay(score: number) {
  return useMemo(() => ({
    label: formatEngagementScore(score),
    color: getEngagementScoreColor(score),
    percentage: Math.min(100, Math.max(0, score)),
  }), [score]);
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  getFeedbackStatusLabel,
  getFeedbackStatusColor,
  getFeedbackTypeIcon,
  getBadgeIcon,
  formatEngagementScore,
  getEngagementScoreColor,
};

export type {
  CoformaConfig,
  CAB,
  CABMember,
  CABInsights,
  Feedback,
  FeedbackType,
  FeedbackStatus,
  RoadmapItem,
  Session,
  Badge,
  ProductFeedbackSummary,
};

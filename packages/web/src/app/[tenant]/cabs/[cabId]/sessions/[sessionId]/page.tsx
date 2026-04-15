'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { trpc } from '../../../../../../lib/trpc';

export default function SessionDetailPage() {
  const params = useParams();
  const utils = trpc.useUtils();
  const cabId = params.cabId as string;
  const sessionId = params.sessionId as string;
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState('');

  // Fetch session data
  const { data: session, isLoading: sessionLoading } = trpc.sessions.getById.useQuery({ id: sessionId });

  // Fetch CAB members to invite
  const { data: membersData } = trpc.cabMembers.list.useQuery({
    cabId,
    limit: 100,
    offset: 0,
  });

  // Fetch session attendees
  const { data: attendeesData, isLoading: attendeesLoading } = trpc.sessionAttendees.list.useQuery({
    sessionId,
    limit: 100,
    offset: 0,
  });

  // Bulk add attendees mutation
  const bulkAddMutation = trpc.sessionAttendees.bulkAdd.useMutation({
    onSuccess: () => {
      utils.sessionAttendees.list.invalidate({ sessionId });
      utils.sessions.getById.invalidate({ id: sessionId });
      setInviteModalOpen(false);
      setSelectedMemberIds([]);
      setInviteError('');
    },
    onError: (err) => {
      setInviteError(err.message || 'Failed to invite members');
    },
  });

  // Remove attendee mutation
  const removeMutation = trpc.sessionAttendees.remove.useMutation({
    onSuccess: () => {
      utils.sessionAttendees.list.invalidate({ sessionId });
      utils.sessions.getById.invalidate({ id: sessionId });
    },
  });

  // Update session status mutation
  const updateSessionMutation = trpc.sessions.update.useMutation({
    onSuccess: () => {
      utils.sessions.getById.invalidate({ id: sessionId });
    },
  });

  // Loading state
  if (sessionLoading || attendeesLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <h3 className="text-xl font-semibold mb-2">Session Not Found</h3>
          <Link
            href={`/${params.tenant}/cabs/${cabId}/sessions`}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
          >
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  const attendees = attendeesData?.attendees || [];
  const members = membersData?.members || [];

  // Filter out members who are already attendees
  const attendeeUserIds = new Set(attendees.map((a) => a.userId));
  const availableMembers = members.filter((m) => !attendeeUserIds.has(m.userId));

  const attendedCount = attendees.filter((a) => a.attended).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/${params.tenant}/cabs/${cabId}/sessions`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Sessions
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{session.title}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                session.status === 'SCHEDULED' ? 'bg-blue-500/10 text-blue-600' :
                session.status === 'IN_PROGRESS' ? 'bg-green-500/10 text-green-600' :
                session.status === 'COMPLETED' ? 'bg-muted text-muted-foreground' :
                'bg-destructive/10 text-destructive'
              }`}>
                {session.status}
              </span>
            </div>
            <p className="text-muted-foreground">
              {new Date(session.scheduledAt).toLocaleDateString()} at{' '}
              {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' • '}{session.duration} minutes
            </p>
          </div>

          <div className="flex gap-2">
            {session.status === 'SCHEDULED' && (
              <button
                onClick={() => updateSessionMutation.mutate({ id: sessionId, status: 'IN_PROGRESS' })}
                disabled={updateSessionMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                Start Session
              </button>
            )}
            {session.status === 'IN_PROGRESS' && (
              <button
                onClick={() => updateSessionMutation.mutate({ id: sessionId, status: 'COMPLETED' })}
                disabled={updateSessionMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                End Session
              </button>
            )}
            {session.meetingLink && session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-input rounded-lg font-semibold hover:bg-accent transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Join Meeting
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Session Details */}
      <div className="bg-card border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Session Details</h2>
        <div className="space-y-4">
          {session.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="mt-1">{session.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Invited</label>
              <p className="mt-1 text-2xl font-bold">{attendees.length}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Attended</label>
              <p className="mt-1 text-2xl font-bold">{attendedCount}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">No Show</label>
              <p className="mt-1 text-2xl font-bold">{attendees.length - attendedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendees Section */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Attendees ({attendees.length})</h2>
          <button
            onClick={() => setInviteModalOpen(true)}
            disabled={availableMembers.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Members
          </button>
        </div>

        {attendees.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">No attendees yet</h3>
            <p className="text-muted-foreground mb-6">
              Invite CAB members to this session
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {attendees.map((attendee) => (
              <div key={attendee.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {attendee.user.avatar ? (
                      <img src={attendee.user.avatar} alt={attendee.user.name || ''} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-primary">
                        {(attendee.user.name || attendee.user.email).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium">{attendee.user.name || attendee.user.email}</h4>
                    <p className="text-sm text-muted-foreground">{attendee.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {attendee.attended && (
                    <span className="text-sm px-3 py-1 bg-green-500/10 text-green-600 rounded-full">
                      Attended
                    </span>
                  )}
                  {attendee.joinedAt && attendee.leftAt && (
                    <span className="text-sm text-muted-foreground">
                      {Math.round((new Date(attendee.leftAt).getTime() - new Date(attendee.joinedAt).getTime()) / 60000)} min
                    </span>
                  )}
                  <button
                    onClick={() => removeMutation.mutate({ id: attendee.id })}
                    disabled={removeMutation.isPending}
                    className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Members Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Invite Members</h3>
              <button
                onClick={() => {
                  setInviteModalOpen(false);
                  setSelectedMemberIds([]);
                  setInviteError('');
                }}
                className="p-2 hover:bg-accent rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {inviteError && (
              <div className="mb-4 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                <p className="text-sm">{inviteError}</p>
              </div>
            )}

            {availableMembers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">All CAB members have been invited to this session.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select members to invite to this session:
                </p>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {availableMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.userId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMemberIds([...selectedMemberIds, member.userId]);
                          } else {
                            setSelectedMemberIds(selectedMemberIds.filter((id) => id !== member.userId));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{member.user.name || member.user.email}</p>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      if (selectedMemberIds.length > 0) {
                        bulkAddMutation.mutate({
                          sessionId,
                          userIds: selectedMemberIds,
                        });
                      }
                    }}
                    disabled={selectedMemberIds.length === 0 || bulkAddMutation.isPending}
                    className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    {bulkAddMutation.isPending ? 'Inviting...' : `Invite ${selectedMemberIds.length} Member${selectedMemberIds.length !== 1 ? 's' : ''}`}
                  </button>
                  <button
                    onClick={() => {
                      setInviteModalOpen(false);
                      setSelectedMemberIds([]);
                      setInviteError('');
                    }}
                    disabled={bulkAddMutation.isPending}
                    className="px-4 py-3 border border-input rounded-lg font-semibold hover:bg-accent transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

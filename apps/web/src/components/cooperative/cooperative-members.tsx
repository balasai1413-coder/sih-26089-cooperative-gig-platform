'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { Badge, VerificationBadge } from '@/components/ui/badge';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  LoadingSpinner,
  Modal,
  Skeleton,
  Toast,
} from '@/components/ui/feedback';
import { Select, TextInput } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { cooperativeApi } from '@/lib/api/cooperative';
import { useAuth } from '@/lib/auth/auth-context';
import type { CooperativeMember, MemberDetail } from '@/types/cooperative';

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not load that information. Please try again.';
}

export function CooperativeMembers() {
  const { accessToken } = useAuth();
  const [cooperativeId, setCooperativeId] = useState('');
  const [members, setMembers] = useState<CooperativeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'former'>('active');
  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const list = await cooperativeApi.list(accessToken);
      const target = list[0];
      if (!target) {
        setMembers([]);
        setCooperativeId('');
        setLoading(false);
        return;
      }
      setCooperativeId(target.id);
      const data = await cooperativeApi.members(accessToken, target.id, {
        search: search || undefined,
        status,
      });
      setMembers(data);
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openMember(workerId: string) {
    if (!accessToken || !cooperativeId) return;
    setDetailLoading(true);
    setDetailError('');
    setSelected(null);
    try {
      const detail = await cooperativeApi.member(accessToken, cooperativeId, workerId);
      setSelected(detail);
    } catch (detailLoadError) {
      setDetailError(friendlyError(detailLoadError));
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) return <MembersLoading />;
  if (error)
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  if (!cooperativeId) {
    return (
      <GlassCard className="dashboard-placeholder">
        <EmptyState
          icon="users"
          title="No cooperative yet."
          description="Add a cooperative to see its members here."
        />
      </GlassCard>
    );
  }

  return (
    <>
      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">Member network</p>
          <h1>Know the people in your cooperative.</h1>
          <p>View profiles, skills, and verification status for every member.</p>
        </div>
      </div>

      <div className="member-controls">
        <div className="member-search">
          <Icon name="search" />
          <TextInput
            label="Search members"
            placeholder="Search by name or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          label="Membership"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'former')}
        >
          <option value="active">Active</option>
          <option value="former">Former</option>
        </Select>
        <SecondaryButton icon="search" onClick={() => void load()}>
          Search
        </SecondaryButton>
      </div>

      {members.length ? (
        <div className="member-list">
          {members.map((member) => (
            <GlassCard key={member.membershipId} className="member-row">
              <div className="member-row__identity">
                <span className="review-row__avatar">
                  {(member.fullName || 'W').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{member.fullName || 'Worker'}</h3>
                  <p>
                    {member.location || 'No location'} · {member.skillCount} skills ·{' '}
                    {member.verifiedSkillCount} verified
                  </p>
                </div>
              </div>
              <Badge tone={member.membershipStatus === 'ACTIVE' ? 'success' : 'warning'}>
                {member.membershipStatus === 'ACTIVE' ? 'Active' : 'Former'}
              </Badge>
              <Button size="sm" onClick={() => void openMember(member.workerId)}>
                View profile
              </Button>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="dashboard-placeholder">
          <EmptyState
            icon="users"
            title="No members found."
            description="Adjust your search or filters, or invite workers to join."
          />
        </GlassCard>
      )}

      <Modal
        open={Boolean(selected) || detailLoading}
        title={selected ? selected.fullName || 'Member' : 'Loading'}
        onClose={() => setSelected(null)}
      >
        {detailLoading ? <LoadingSpinner label="Loading member profile" /> : null}
        {detailError ? (
          <Toast tone="error" message={detailError} onDismiss={() => setDetailError('')} />
        ) : null}
        {selected ? <MemberDetailView member={selected} /> : null}
      </Modal>
    </>
  );
}

function MemberDetailView({ member }: { member: MemberDetail }) {
  return (
    <div className="member-detail">
      <div className="member-detail__header">
        <span className="profile-avatar">{(member.fullName || 'W').slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{member.fullName || 'Worker'}</h2>
          <p>
            {member.location || 'No location'} · {member.yearsExperience ?? 0} years experience
          </p>
          <p>{member.email}</p>
        </div>
      </div>
      <div className="member-detail__section">
        <h3>Skills ({member.skillCount})</h3>
        {member.skills.length ? (
          <div className="member-skills">
            {member.skills.map((skill) => (
              <div key={skill.id} className="member-skill">
                <div>
                  <b>{skill.name}</b>
                  {skill.category ? <span> · {skill.category}</span> : null}
                  {skill.proficiency ? <span> · {skill.proficiency.toLowerCase()}</span> : null}
                </div>
                {skill.verificationStatus === 'VERIFIED' ? (
                  <VerificationBadge />
                ) : (
                  <Badge>{skill.verificationStatus.toLowerCase().replace('_', ' ')}</Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No skills recorded yet.</p>
        )}
      </div>
    </div>
  );
}

function MembersLoading() {
  return (
    <div className="worker-studio worker-studio--loading">
      <Skeleton className="dashboard-loading__title" />
      <div className="member-list">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <LoadingSpinner label="Loading members" />
    </div>
  );
}

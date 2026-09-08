'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Badge, VerificationBadge } from '@/components/ui/badge';
import { Button, IconButton, SecondaryButton } from '@/components/ui/button';
import { GlassCard, InteractiveCard } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  LoadingSpinner,
  Modal,
  Skeleton,
  Toast,
} from '@/components/ui/feedback';
import { Select, Textarea, TextInput } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { workerApi } from '@/lib/api/worker';
import { useAuth } from '@/lib/auth/auth-context';
import type {
  Certificate,
  CertificatePayload,
  SkillEvidence,
  SkillEvidencePayload,
  SkillProficiency,
  SkillVerificationStatus,
  UpdateWorkerProfilePayload,
  VerificationMethod,
  VerificationRequest,
  WorkerAvailability,
  WorkerExperience,
  WorkerExperiencePayload,
  WorkerProfile,
  WorkerSkill,
} from '@/types/worker';

export type WorkerStudioSection =
  'Profile' | 'Skills' | 'Evidence' | 'Certificates' | 'Verification';

type WorkspaceData = {
  profile: WorkerProfile;
  skills: WorkerSkill[];
  experiences: WorkerExperience[];
  evidence: SkillEvidence[];
  certificates: Certificate[];
  requests: VerificationRequest[];
  catalog: { id: string; name: string; description: string | null }[];
};

const labelForStatus: Record<SkillVerificationStatus, string> = {
  NOT_VERIFIED: 'Not verified',
  ASSESSMENT_PENDING: 'Assessment pending',
  PENDING: 'Review pending',
  VERIFIED: 'Verified',
  REJECTED: 'Needs more evidence',
};

const labelForMethod: Record<VerificationMethod, string> = {
  PRACTICAL_ASSESSMENT: 'Practical assessment',
  EXPERIENCE_EVIDENCE: 'Experience evidence',
  CERTIFICATE_EVIDENCE: 'Certificate evidence',
  ADMIN_REVIEW: 'Admin review',
};

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not complete that action. Please try again.';
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function statusBadge(status: SkillVerificationStatus) {
  if (status === 'VERIFIED') return <VerificationBadge />;
  if (status === 'REJECTED') return <Badge tone="danger">{labelForStatus[status]}</Badge>;
  if (status === 'PENDING' || status === 'ASSESSMENT_PENDING')
    return <Badge tone="warning">{labelForStatus[status]}</Badge>;
  return <Badge>{labelForStatus[status]}</Badge>;
}

export function WorkerProfileStudio({ active }: { active: WorkerStudioSection }) {
  const { status, accessToken } = useAuth();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<
    'profile' | 'skill' | 'experience' | 'evidence' | 'certificate' | 'request' | null
  >(null);
  const [editingExperience, setEditingExperience] = useState<WorkerExperience | null>(null);
  const [editingSkill, setEditingSkill] = useState<WorkerSkill | null>(null);
  const [requestingSkill, setRequestingSkill] = useState<WorkerSkill | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    setError('');
    try {
      const [profile, skills, experiences, evidence, certificates, requests, catalog] =
        await Promise.all([
          workerApi.profile(accessToken),
          workerApi.skills(accessToken),
          workerApi.experiences(accessToken),
          workerApi.evidence(accessToken),
          workerApi.certificates(accessToken),
          workerApi.verificationRequests(accessToken),
          workerApi.catalog(accessToken),
        ]);
      setData({ profile, skills, experiences, evidence, certificates, requests, catalog });
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [load, status]);

  async function complete(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      setModal(null);
      setEditingExperience(null);
      setEditingSkill(null);
      setRequestingSkill(null);
      setNotice(message);
      await load();
    } catch (actionError) {
      setError(friendlyError(actionError));
    }
  }

  if (status === 'loading' || (refreshing && !data)) return <StudioLoading />;
  if (status !== 'authenticated' || !accessToken) return null;
  if (!data) {
    return (
      <ErrorState
        description={error || 'Your profile space is unavailable right now.'}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }

  const content = {
    Profile: (
      <ProfileSection
        profile={data.profile}
        onEdit={() => setModal('profile')}
        experiences={data.experiences}
        onAddExperience={() => {
          setEditingExperience(null);
          setModal('experience');
        }}
        onEditExperience={(experience) => {
          setEditingExperience(experience);
          setModal('experience');
        }}
        onDeleteExperience={(experience) =>
          void complete(
            () => workerApi.removeExperience(accessToken, experience.id),
            'Experience removed.',
          )
        }
      />
    ),
    Skills: (
      <SkillsSection
        skills={data.skills}
        onAdd={() => setModal('skill')}
        onEdit={(skill) => {
          setEditingSkill(skill);
          setModal('skill');
        }}
        onRequest={(skill) => {
          setRequestingSkill(skill);
          setModal('request');
        }}
        onDelete={(skill) =>
          void complete(
            () => workerApi.removeSkill(accessToken, skill.id),
            'Skill removed from your profile.',
          )
        }
      />
    ),
    Evidence: (
      <EvidenceSection
        evidence={data.evidence}
        onAdd={() => setModal('evidence')}
        onDelete={(item) =>
          void complete(() => workerApi.removeEvidence(accessToken, item.id), 'Evidence removed.')
        }
      />
    ),
    Certificates: (
      <CertificatesSection
        certificates={data.certificates}
        onAdd={() => setModal('certificate')}
        onDelete={(certificate) =>
          void complete(
            () => workerApi.removeCertificate(accessToken, certificate.id),
            'Certificate metadata removed.',
          )
        }
      />
    ),
    Verification: <VerificationSection requests={data.requests} />,
  } satisfies Record<WorkerStudioSection, React.ReactNode>;

  return (
    <section className="worker-studio">
      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">Competency profile</p>
          <h1>{active === 'Profile' ? 'Let your work speak for itself.' : active}</h1>
          <p>
            Credentials can support your story. Evidence and thoughtful review are what make a skill
            verified.
          </p>
        </div>
        <IconButton
          label="Refresh profile data"
          icon="zap"
          onClick={() => void load()}
          loading={refreshing}
        />
      </div>
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {content[active]}

      <Modal open={modal === 'profile'} title="Edit your profile" onClose={() => setModal(null)}>
        <ProfileForm
          profile={data.profile}
          onSubmit={(payload) =>
            void complete(() => workerApi.updateProfile(accessToken, payload), 'Profile saved.')
          }
        />
      </Modal>
      <Modal
        open={modal === 'experience'}
        title={editingExperience ? 'Edit practical experience' : 'Add practical experience'}
        onClose={() => setModal(null)}
      >
        <ExperienceForm
          experience={editingExperience}
          onSubmit={(payload) =>
            void complete(
              () =>
                editingExperience
                  ? workerApi.updateExperience(accessToken, editingExperience.id, payload)
                  : workerApi.addExperience(accessToken, payload),
              editingExperience ? 'Experience updated.' : 'Experience added.',
            )
          }
        />
      </Modal>
      <Modal
        open={modal === 'skill'}
        title={editingSkill ? `Edit ${editingSkill.skill.name}` : 'Add a skill'}
        onClose={() => setModal(null)}
      >
        <SkillForm
          catalog={data.catalog}
          skill={editingSkill}
          onSubmit={(payload) =>
            void complete(
              () =>
                editingSkill
                  ? workerApi.updateSkill(accessToken, editingSkill.id, payload)
                  : workerApi.addSkill(accessToken, payload as Required<typeof payload>),
              editingSkill ? 'Skill updated.' : 'Skill added. It is not verified yet.',
            )
          }
        />
      </Modal>
      <Modal open={modal === 'evidence'} title="Add skill evidence" onClose={() => setModal(null)}>
        <EvidenceForm
          skills={data.skills}
          experiences={data.experiences}
          onSubmit={(workerSkillId, payload) =>
            void complete(
              () => workerApi.addEvidence(accessToken, workerSkillId, payload),
              'Evidence added.',
            )
          }
        />
      </Modal>
      <Modal
        open={modal === 'certificate'}
        title="Add certificate metadata"
        onClose={() => setModal(null)}
      >
        <CertificateForm
          skills={data.skills}
          onSubmit={(workerSkillId, payload) =>
            void complete(
              () => workerApi.addCertificate(accessToken, workerSkillId, payload),
              'Certificate saved as supporting evidence—not a verification.',
            )
          }
        />
      </Modal>
      <Modal
        open={modal === 'request'}
        title={`Request verification${requestingSkill ? ` · ${requestingSkill.skill.name}` : ''}`}
        onClose={() => setModal(null)}
      >
        {requestingSkill ? (
          <VerificationRequestForm
            onSubmit={(payload) =>
              void complete(
                () => workerApi.requestVerification(accessToken, requestingSkill.id, payload),
                'Verification request submitted for review.',
              )
            }
          />
        ) : null}
      </Modal>
    </section>
  );
}

function ProfileSection({
  profile,
  experiences,
  onEdit,
  onAddExperience,
  onEditExperience,
  onDeleteExperience,
}: {
  profile: WorkerProfile;
  experiences: WorkerExperience[];
  onEdit: () => void;
  onAddExperience: () => void;
  onEditExperience: (experience: WorkerExperience) => void;
  onDeleteExperience: (experience: WorkerExperience) => void;
}) {
  const initials = (profile.fullName || 'S').slice(0, 1).toUpperCase();
  return (
    <div className="worker-studio__stack">
      <GlassCard className="profile-hero-card">
        <div className="profile-hero-card__identity">
          <span className="profile-avatar">
            {profile.profilePhotoUrl ? (
              // This user-supplied URL may be hosted by any permitted image provider, so it cannot
              // use Next's build-time remote-host allowlist. It is decorative beside the name.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.profilePhotoUrl} alt="" />
            ) : (
              initials
            )}
          </span>
          <div>
            <p>Worker profile</p>
            <h2>{profile.fullName || 'Your professional profile'}</h2>
            <span>{profile.location || 'Add a location to make your work easier to find'}</span>
          </div>
        </div>
        <div
          className="completion-meter"
          aria-label={`Profile ${profile.profileCompletion}% complete`}
        >
          <span style={{ '--completion': `${profile.profileCompletion}%` } as CSSProperties}>
            <b>{profile.profileCompletion}%</b>
          </span>
          <small>Profile completion</small>
        </div>
        <Button variant="secondary" icon="plus" onClick={onEdit}>
          Edit profile
        </Button>
      </GlassCard>
      <div className="worker-detail-grid">
        <InteractiveCard className="worker-detail-card">
          <Icon name="briefcase" />
          <div>
            <span>Availability</span>
            <b>{profile.availability?.toLowerCase().replace('_', ' ') || 'Not set'}</b>
          </div>
        </InteractiveCard>
        <InteractiveCard className="worker-detail-card">
          <Icon name="zap" />
          <div>
            <span>Practical experience</span>
            <b>{profile.yearsExperience ?? 0} years declared</b>
          </div>
        </InteractiveCard>
        <InteractiveCard className="worker-detail-card">
          <Icon name="users" />
          <div>
            <span>Languages</span>
            <b>{profile.languages.length ? profile.languages.join(', ') : 'Not added'}</b>
          </div>
        </InteractiveCard>
      </div>
      <GlassCard className="profile-about-card">
        <div className="card-heading">
          <div>
            <p>About your work</p>
            <h2>{profile.bio ? 'Your story, in your words.' : 'Make your profile more human.'}</h2>
          </div>
          {profile.education ? <Badge tone="cyan">Education is optional</Badge> : null}
        </div>
        <p>
          {profile.bio ||
            'Add a short introduction. Practical experience and evidence can stand on their own.'}
        </p>
      </GlassCard>
      <section className="studio-section">
        <div className="studio-section__head">
          <div>
            <p className="dashboard-overline">Practical experience</p>
            <h2>Show the work behind your skills.</h2>
          </div>
          <Button icon="plus" onClick={onAddExperience}>
            Add experience
          </Button>
        </div>
        {experiences.length ? (
          <div className="experience-list">
            {experiences.map((experience) => (
              <GlassCard key={experience.id} className="experience-row">
                <div>
                  <h3>{experience.title}</h3>
                  <p>
                    {[experience.organization, experience.isCurrent ? 'Current role' : null]
                      .filter(Boolean)
                      .join(' · ') || 'Independent work'}
                  </p>
                  {experience.description ? <small>{experience.description}</small> : null}
                  {experience.relevantSkills.length ? (
                    <div className="mini-tags">
                      {experience.relevantSkills.map((skill) => (
                        <span key={skill}>{skill}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="row-actions">
                  <IconButton
                    label="Edit experience"
                    icon="plus"
                    onClick={() => onEditExperience(experience)}
                  />
                  <IconButton
                    label="Remove experience"
                    icon="close"
                    onClick={() => onDeleteExperience(experience)}
                  />
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="briefcase"
            title="Your work history has room to grow."
            description="Add practical experience as evidence. It supports review, but does not automatically verify a skill."
          />
        )}
      </section>
    </div>
  );
}

function SkillsSection({
  skills,
  onAdd,
  onEdit,
  onRequest,
  onDelete,
}: {
  skills: WorkerSkill[];
  onAdd: () => void;
  onEdit: (skill: WorkerSkill) => void;
  onRequest: (skill: WorkerSkill) => void;
  onDelete: (skill: WorkerSkill) => void;
}) {
  return (
    <section className="studio-section">
      <div className="studio-section__head">
        <div>
          <p className="dashboard-overline">Skill ledger</p>
          <h2>Competency, made visible.</h2>
        </div>
        <Button icon="plus" onClick={onAdd}>
          Add a skill
        </Button>
      </div>
      {skills.length ? (
        <div className="skill-studio-grid">
          {skills.map((skill) => (
            <InteractiveCard key={skill.id} className="skill-studio-card">
              <div className="skill-studio-card__top">
                <span className="skill-studio-card__icon">
                  <Icon name="zap" />
                </span>
                {statusBadge(skill.verificationStatus)}
              </div>
              <h3>{skill.skill.name}</h3>
              <p>
                {skill.proficiency.toLowerCase()} · {skill.experienceYears} years practical
                experience
              </p>
              {skill.experienceSummary ? (
                <small>{skill.experienceSummary}</small>
              ) : (
                <small>Add a practical summary to make review easier.</small>
              )}
              <div className="skill-studio-card__meta">
                <span>
                  <Icon name="shield" /> {skill.evidenceCount} evidence
                </span>
                <span>
                  <Icon name="verify" /> {skill.certificateCount} certificates
                </span>
              </div>
              {skill.latestVerification?.note && skill.verificationStatus === 'REJECTED' ? (
                <p className="rejection-note">{skill.latestVerification.note}</p>
              ) : null}
              <div className="skill-studio-card__actions">
                <SecondaryButton size="sm" onClick={() => onEdit(skill)}>
                  Edit
                </SecondaryButton>
                {skill.verificationStatus === 'NOT_VERIFIED' ||
                skill.verificationStatus === 'REJECTED' ? (
                  <Button size="sm" onClick={() => onRequest(skill)}>
                    Request review
                  </Button>
                ) : null}
                <IconButton
                  label={`Remove ${skill.skill.name}`}
                  icon="close"
                  size="sm"
                  onClick={() => onDelete(skill)}
                />
              </div>
            </InteractiveCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="zap"
          title="Start with a skill you practise."
          description="Choose a skill from the shared catalog, add practical context, then request a human review when ready."
          action={
            <Button icon="plus" onClick={onAdd}>
              Browse skills
            </Button>
          }
        />
      )}
    </section>
  );
}

function EvidenceSection({
  evidence,
  onAdd,
  onDelete,
}: {
  evidence: SkillEvidence[];
  onAdd: () => void;
  onDelete: (item: SkillEvidence) => void;
}) {
  return (
    <section className="studio-section">
      <div className="studio-section__head">
        <div>
          <p className="dashboard-overline">Evidence library</p>
          <h2>Give reviewers the useful context.</h2>
        </div>
        <Button icon="plus" onClick={onAdd}>
          Add evidence
        </Button>
      </div>
      {evidence.length ? (
        <div className="evidence-list">
          {evidence.map((item) => (
            <GlassCard key={item.id} className="evidence-row">
              <span className="evidence-row__icon">
                <Icon name="shield" />
              </span>
              <div>
                <Badge tone="cyan">{item.type.toLowerCase().replaceAll('_', ' ')}</Badge>
                <h3>{item.skill.name}</h3>
                <p>{item.description}</p>
                {item.experience ? <small>Linked to {item.experience.title}</small> : null}
                {item.referenceUrl ? (
                  <a
                    className="text-link"
                    href={item.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open reference <Icon name="arrow-up-right" />
                  </a>
                ) : null}
              </div>
              <IconButton label="Remove evidence" icon="close" onClick={() => onDelete(item)} />
            </GlassCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="shield"
          title="Evidence stays in your hands."
          description="Add work samples, experience notes, training, assessments, or trusted references. No file upload is implied."
          action={
            <Button icon="plus" onClick={onAdd}>
              Add evidence
            </Button>
          }
        />
      )}
    </section>
  );
}

function CertificatesSection({
  certificates,
  onAdd,
  onDelete,
}: {
  certificates: Certificate[];
  onAdd: () => void;
  onDelete: (certificate: Certificate) => void;
}) {
  return (
    <section className="studio-section">
      <div className="studio-section__head">
        <div>
          <p className="dashboard-overline">Supporting certificates</p>
          <h2>Useful context, never an automatic verdict.</h2>
        </div>
        <Button icon="plus" onClick={onAdd}>
          Add certificate
        </Button>
      </div>
      {certificates.length ? (
        <div className="evidence-list">
          {certificates.map((certificate) => (
            <GlassCard key={certificate.id} className="evidence-row">
              <span className="evidence-row__icon">
                <Icon name="verify" />
              </span>
              <div>
                <Badge tone="violet">{certificate.status.toLowerCase()}</Badge>
                <h3>{certificate.title}</h3>
                <p>
                  {certificate.skill.name}
                  {certificate.issuer ? ` · ${certificate.issuer}` : ''}
                </p>
                {certificate.documentUrl ? (
                  <a
                    className="text-link"
                    href={certificate.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open reference <Icon name="arrow-up-right" />
                  </a>
                ) : null}
              </div>
              <IconButton
                label="Remove certificate"
                icon="close"
                onClick={() => onDelete(certificate)}
              />
            </GlassCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="verify"
          title="Certificates are optional support."
          description="Add accurate certificate metadata when it helps a reviewer understand your work. It never marks a skill verified on its own."
          action={
            <Button icon="plus" onClick={onAdd}>
              Add certificate
            </Button>
          }
        />
      )}
    </section>
  );
}

function VerificationSection({ requests }: { requests: VerificationRequest[] }) {
  return (
    <section className="studio-section">
      <div className="studio-section__head">
        <div>
          <p className="dashboard-overline">Review history</p>
          <h2>Every decision stays clear.</h2>
        </div>
      </div>
      {requests.length ? (
        <div className="verification-timeline">
          {requests.map((request) => (
            <GlassCard key={request.id} className="verification-row">
              <div>
                <span className="verification-row__line" />
                <h3>{request.skill.name}</h3>
                <p>
                  {request.method ? labelForMethod[request.method] : 'Review request'} · requested{' '}
                  {new Date(request.requestedAt).toLocaleDateString()}
                </p>
                {request.note ? <small>{request.note}</small> : null}
              </div>
              {statusBadge(request.status)}
            </GlassCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="verify"
          title="No reviews yet."
          description="When you request a review, its status and any reviewer note will appear here."
        />
      )}
    </section>
  );
}

function ProfileForm({
  profile,
  onSubmit,
}: {
  profile: WorkerProfile;
  onSubmit: (payload: UpdateWorkerProfilePayload) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      fullName: String(form.get('fullName') || '') || null,
      profilePhotoUrl: String(form.get('profilePhotoUrl') || '') || null,
      bio: String(form.get('bio') || '') || null,
      location: String(form.get('location') || '') || null,
      yearsExperience: form.get('yearsExperience') ? Number(form.get('yearsExperience')) : null,
      availability: (String(form.get('availability') || '') || null) as WorkerAvailability | null,
      languages: String(form.get('languages') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      educationQualification: String(form.get('educationQualification') || '') || null,
      educationInstitution: String(form.get('educationInstitution') || '') || null,
      educationYear: form.get('educationYear') ? Number(form.get('educationYear')) : null,
    });
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <TextInput label="Full name" name="fullName" defaultValue={profile.fullName || ''} />
      <TextInput
        label="Profile photo URL"
        name="profilePhotoUrl"
        type="url"
        defaultValue={profile.profilePhotoUrl || ''}
        hint="A reference URL only; file uploads are not assumed."
      />
      <Textarea label="About your work" name="bio" defaultValue={profile.bio || ''} />
      <TextInput label="Location" name="location" defaultValue={profile.location || ''} />
      <div className="studio-form__split">
        <TextInput
          label="Years of practical experience"
          name="yearsExperience"
          type="number"
          min="0"
          max="80"
          defaultValue={profile.yearsExperience ?? ''}
        />
        <Select label="Availability" name="availability" defaultValue={profile.availability || ''}>
          <option value="">Not set</option>
          <option value="AVAILABLE">Available</option>
          <option value="LIMITED">Limited availability</option>
          <option value="UNAVAILABLE">Unavailable</option>
        </Select>
      </div>
      <TextInput
        label="Languages"
        name="languages"
        defaultValue={profile.languages.join(', ')}
        hint="Separate languages with commas."
      />
      <div className="form-divider">
        <span>Optional education context</span>
      </div>
      <TextInput
        label="Qualification"
        name="educationQualification"
        defaultValue={profile.education?.qualification || ''}
      />
      <TextInput
        label="Institution"
        name="educationInstitution"
        defaultValue={profile.education?.institution || ''}
      />
      <TextInput
        label="Year"
        name="educationYear"
        type="number"
        min="1900"
        max="2100"
        defaultValue={profile.education?.year || ''}
      />
      <Button type="submit" icon="check">
        Save profile
      </Button>
    </form>
  );
}

function ExperienceForm({
  experience,
  onSubmit,
}: {
  experience: WorkerExperience | null;
  onSubmit: (payload: WorkerExperiencePayload) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isCurrent = form.get('isCurrent') === 'on';
    onSubmit({
      title: String(form.get('title')),
      organization: String(form.get('organization') || '') || null,
      startDate: String(form.get('startDate') || '') || null,
      endDate: isCurrent ? null : String(form.get('endDate') || '') || null,
      isCurrent,
      description: String(form.get('description') || '') || null,
      relevantSkills: String(form.get('relevantSkills') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <TextInput
        label="Role or work title"
        name="title"
        required
        defaultValue={experience?.title || ''}
      />
      <TextInput
        label="Organisation or client"
        name="organization"
        defaultValue={experience?.organization || ''}
      />
      <div className="studio-form__split">
        <TextInput
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={dateValue(experience?.startDate)}
        />
        <TextInput
          label="End date"
          name="endDate"
          type="date"
          defaultValue={dateValue(experience?.endDate)}
        />
      </div>
      <label className="check-control">
        <input type="checkbox" name="isCurrent" defaultChecked={experience?.isCurrent} /> I
        currently do this work
      </label>
      <Textarea
        label="What did this work involve?"
        name="description"
        defaultValue={experience?.description || ''}
      />
      <TextInput
        label="Relevant skills"
        name="relevantSkills"
        defaultValue={experience?.relevantSkills.join(', ') || ''}
        hint="Separate skill names with commas."
      />
      <Button type="submit" icon="check">
        Save experience
      </Button>
    </form>
  );
}

function SkillForm({
  catalog,
  skill,
  onSubmit,
}: {
  catalog: { id: string; name: string; description: string | null }[];
  skill: WorkerSkill | null;
  onSubmit: (
    payload: Partial<{
      skillId: string;
      proficiency: SkillProficiency;
      experienceYears: number;
      experienceSummary: string | null;
      evidenceReference: string | null;
    }>,
  ) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      ...(skill ? {} : { skillId: String(form.get('skillId')) }),
      proficiency: String(form.get('proficiency')) as SkillProficiency,
      experienceYears: Number(form.get('experienceYears')),
      experienceSummary: String(form.get('experienceSummary') || '') || null,
      evidenceReference: String(form.get('evidenceReference') || '') || null,
    });
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      {skill ? (
        <TextInput label="Skill" value={skill.skill.name} disabled />
      ) : (
        <Select label="Skill from catalog" name="skillId" required defaultValue="">
          <option value="" disabled>
            {catalog.length ? 'Choose a skill' : 'The catalog is currently empty'}
          </option>
          {catalog.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      )}
      <div className="studio-form__split">
        <Select
          label="Practical proficiency"
          name="proficiency"
          defaultValue={skill?.proficiency || 'INTERMEDIATE'}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
          <option value="EXPERT">Expert</option>
        </Select>
        <TextInput
          label="Years of experience"
          name="experienceYears"
          type="number"
          min="0"
          max="80"
          required
          defaultValue={skill?.experienceYears ?? 0}
        />
      </div>
      <Textarea
        label="Practical context"
        name="experienceSummary"
        defaultValue={skill?.experienceSummary || ''}
        hint="Describe what you have actually practised."
      />
      <TextInput
        label="Existing public reference URL"
        name="evidenceReference"
        type="url"
        defaultValue={skill?.evidenceReference || ''}
        hint="Optional; add separate evidence below for a fuller record."
      />
      <Button type="submit" icon="check" disabled={!skill && !catalog.length}>
        {skill ? 'Save skill' : 'Add skill'}
      </Button>
    </form>
  );
}

function EvidenceForm({
  skills,
  experiences,
  onSubmit,
}: {
  skills: WorkerSkill[];
  experiences: WorkerExperience[];
  onSubmit: (workerSkillId: string, payload: SkillEvidencePayload) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(String(form.get('workerSkillId')), {
      type: String(form.get('type')) as SkillEvidencePayload['type'],
      description: String(form.get('description')),
      referenceUrl: String(form.get('referenceUrl') || '') || null,
      experienceId: String(form.get('experienceId') || '') || null,
    });
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <Select label="Related skill" name="workerSkillId" required defaultValue="">
        <option value="" disabled>
          Choose a skill
        </option>
        {skills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.skill.name}
          </option>
        ))}
      </Select>
      <Select label="Evidence type" name="type" defaultValue="PRACTICAL_EXPERIENCE">
        <option value="PRACTICAL_EXPERIENCE">Practical experience</option>
        <option value="WORK_SAMPLE">Work sample / portfolio</option>
        <option value="ASSESSMENT">Assessment</option>
        <option value="TRAINING">Training</option>
        <option value="CERTIFICATE">Certificate</option>
        <option value="EMPLOYER_OR_CLIENT">Employer or client reference</option>
        <option value="OTHER">Other evidence</option>
      </Select>
      <Textarea label="What does this demonstrate?" name="description" required />
      <TextInput
        label="Reference URL"
        name="referenceUrl"
        type="url"
        hint="Optional external reference. No file upload is created."
      />
      <Select label="Link to your experience" name="experienceId" defaultValue="">
        <option value="">No linked experience</option>
        {experiences.map((experience) => (
          <option key={experience.id} value={experience.id}>
            {experience.title}
          </option>
        ))}
      </Select>
      <Button type="submit" icon="check" disabled={!skills.length}>
        Save evidence
      </Button>
    </form>
  );
}

function CertificateForm({
  skills,
  onSubmit,
}: {
  skills: WorkerSkill[];
  onSubmit: (workerSkillId: string, payload: CertificatePayload) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(String(form.get('workerSkillId')), {
      title: String(form.get('title')),
      issuer: String(form.get('issuer') || '') || null,
      referenceNo: String(form.get('referenceNo') || '') || null,
      documentUrl: String(form.get('documentUrl') || '') || null,
      issuedAt: String(form.get('issuedAt') || '') || null,
      expiresAt: String(form.get('expiresAt') || '') || null,
    });
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <Select label="Related skill" name="workerSkillId" required defaultValue="">
        <option value="" disabled>
          Choose a skill
        </option>
        {skills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.skill.name}
          </option>
        ))}
      </Select>
      <TextInput label="Certificate title" name="title" required />
      <TextInput label="Issuing organisation" name="issuer" />
      <TextInput label="Certificate reference number" name="referenceNo" />
      <TextInput
        label="Document or reference URL"
        name="documentUrl"
        type="url"
        hint="Optional metadata link only; this does not upload a file."
      />
      <div className="studio-form__split">
        <TextInput label="Issue date" name="issuedAt" type="date" />
        <TextInput label="Expiry date" name="expiresAt" type="date" />
      </div>
      <Button type="submit" icon="check" disabled={!skills.length}>
        Save certificate
      </Button>
    </form>
  );
}

function VerificationRequestForm({
  onSubmit,
}: {
  onSubmit: (payload: {
    method: VerificationMethod;
    evidenceReference?: string | null;
    assessmentReference?: string | null;
    note?: string | null;
  }) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      method: String(form.get('method')) as VerificationMethod,
      evidenceReference: String(form.get('evidenceReference') || '') || null,
      assessmentReference: String(form.get('assessmentReference') || '') || null,
      note: String(form.get('note') || '') || null,
    });
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <p className="modal__description">
        A request begins as <b>pending</b>. Experience, certificates, and evidence support the
        review; none verifies the skill automatically.
      </p>
      <Select label="Suggested review method" name="method" defaultValue="EXPERIENCE_EVIDENCE">
        <option value="EXPERIENCE_EVIDENCE">Experience evidence</option>
        <option value="PRACTICAL_ASSESSMENT">Practical assessment</option>
        <option value="CERTIFICATE_EVIDENCE">Certificate evidence</option>
        <option value="ADMIN_REVIEW">Admin review</option>
      </Select>
      <TextInput label="Extra evidence reference" name="evidenceReference" type="url" />
      <TextInput label="Assessment reference" name="assessmentReference" type="url" />
      <Textarea label="Note for the reviewer" name="note" />
      <Button type="submit" icon="arrow-right" iconPosition="right">
        Submit for review
      </Button>
    </form>
  );
}

function StudioLoading() {
  return (
    <div className="worker-studio worker-studio--loading">
      <Skeleton className="dashboard-loading__title" />
      <Skeleton className="worker-studio--loading__hero" />
      <div className="skill-studio-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <LoadingSpinner label="Loading your competency profile" />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
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
import { Select, TextInput, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { cooperativeApi } from '@/lib/api/cooperative';
import { useAuth } from '@/lib/auth/auth-context';
import type { AdminSkill, CreateSkillPayload, SkillCategory } from '@/types/cooperative';

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not complete that action. Please try again.';
}

export function CooperativeSkillCatalog() {
  const { accessToken } = useAuth();
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminSkill | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [skillsData, categoriesData] = await Promise.all([
        cooperativeApi.skills(accessToken, {
          search: search || undefined,
          categoryId: categoryFilter || undefined,
        }),
        cooperativeApi.categories(accessToken),
      ]);
      setSkills(skillsData);
      setCategories(categoriesData);
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(skill: AdminSkill) {
    if (!accessToken) return;
    try {
      const updated = await cooperativeApi.setSkillStatus(accessToken, skill.id, !skill.active);
      setSkills((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, active: updated.active } : s)),
      );
      setNotice(
        updated.active
          ? 'Skill activated.'
          : 'Skill deactivated. Existing worker skills are preserved.',
      );
    } catch (toggleError) {
      setError(friendlyError(toggleError));
    }
  }

  if (loading) return <CatalogLoading />;
  if (error && !skills.length)
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}
      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">Skill catalog</p>
          <h1>A controlled foundation for matching.</h1>
          <p>
            Curate the skills workers can select. Deactivated skills stay on historical profiles.
          </p>
        </div>
        <Button icon="plus" onClick={() => setCreating(true)}>
          Add skill
        </Button>
      </div>

      <div className="catalog-controls">
        <div className="member-search">
          <Icon name="search" />
          <TextInput
            label="Search skills"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          label="Category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <SecondaryButton icon="search" onClick={() => void load()}>
          Search
        </SecondaryButton>
      </div>

      {skills.length ? (
        <div className="catalog-list">
          {skills.map((skill) => (
            <GlassCard key={skill.id} className="catalog-row">
              <div className="catalog-row__main">
                <div>
                  <h3>{skill.name}</h3>
                  <p>
                    {skill.category?.name || 'Uncategorized'} · {skill.workerCount} workers
                  </p>
                  {skill.description ? <small>{skill.description}</small> : null}
                </div>
                <Badge tone={skill.active ? 'success' : 'warning'}>
                  {skill.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="catalog-row__actions">
                <SecondaryButton size="sm" onClick={() => setEditing(skill)}>
                  Edit
                </SecondaryButton>
                <SecondaryButton size="sm" onClick={() => void toggleStatus(skill)}>
                  {skill.active ? 'Deactivate' : 'Activate'}
                </SecondaryButton>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="dashboard-placeholder">
          <EmptyState
            icon="zap"
            title="No skills yet."
            description="Add the first skill to start building your catalog."
            action={
              <Button icon="plus" onClick={() => setCreating(true)}>
                Add skill
              </Button>
            }
          />
        </GlassCard>
      )}

      <Modal open={creating} title="Add a skill" onClose={() => setCreating(false)}>
        <SkillForm
          categories={categories}
          onSubmit={async (payload) => {
            if (!accessToken) return;
            try {
              await cooperativeApi.createSkill(accessToken, payload);
              setCreating(false);
              setNotice('Skill added to the catalog.');
              await load();
            } catch (submitError) {
              setError(friendlyError(submitError));
            }
          }}
        />
      </Modal>
      <Modal
        open={Boolean(editing)}
        title={editing ? `Edit ${editing.name}` : 'Edit skill'}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <SkillForm
            categories={categories}
            skill={editing}
            onSubmit={async (payload) => {
              if (!accessToken) return;
              try {
                await cooperativeApi.updateSkill(accessToken, editing.id, payload);
                setEditing(null);
                setNotice('Skill updated.');
                await load();
              } catch (submitError) {
                setError(friendlyError(submitError));
              }
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function SkillForm({
  categories,
  skill,
  onSubmit,
}: {
  categories: SkillCategory[];
  skill?: AdminSkill;
  onSubmit: (payload: CreateSkillPayload) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({
        name: String(form.get('name')),
        description: String(form.get('description') || '') || null,
        categoryId: String(form.get('categoryId') || '') || null,
      });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <TextInput label="Skill name" name="name" required defaultValue={skill?.name} />
      <Textarea label="Description" name="description" defaultValue={skill?.description ?? ''} />
      <Select label="Category" name="categoryId" defaultValue={skill?.category?.id ?? ''}>
        <option value="">Uncategorized</option>
        {categories
          .filter((c) => c.active)
          .map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
      </Select>
      <Button type="submit" icon="check" loading={submitting}>
        {skill ? 'Save skill' : 'Add skill'}
      </Button>
    </form>
  );
}

function CatalogLoading() {
  return (
    <div className="worker-studio worker-studio--loading">
      <Skeleton className="dashboard-loading__title" />
      <div className="catalog-list">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <LoadingSpinner label="Loading skill catalog" />
    </div>
  );
}

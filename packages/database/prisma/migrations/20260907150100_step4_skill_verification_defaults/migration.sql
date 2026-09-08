-- The enum value is introduced in the preceding migration. Keeping this in a
-- separate transaction makes PostgreSQL deployments safe when changing the
-- WorkerSkill default to the new skill-first initial state.
ALTER TABLE "WorkerSkill"
  ALTER COLUMN "verificationStatus" SET DEFAULT 'NOT_VERIFIED';

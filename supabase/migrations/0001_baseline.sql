-- 0001_baseline
-- The initial schema is maintained in ../schema.sql (idempotent full snapshot).
-- For a fresh database, run that file. This baseline exists only to anchor the
-- migration sequence; it intentionally applies no changes of its own.
select 'baseline: run ../schema.sql for the full initial schema' as note;

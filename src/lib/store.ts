/**
 * store.ts — ARCHIVED
 *
 * This file previously contained hardcoded mock data arrays:
 *   INITIAL_USERS, INITIAL_REFERENCE_DATA, INITIAL_FUNDS,
 *   INITIAL_CHECKLISTS, INITIAL_AUDIT_LOGS
 *
 * All of these have been removed. They were supplanting real database reads.
 *
 * PRODUCTION DATA SOURCE:
 *   All reference data, fund rules, users, roles, and checklists are
 *   seeded via supabase/schema.sql and fetched live from Supabase PostgreSQL.
 *
 * DATABASE SEEDING:
 *   Run supabase/schema.sql in the Supabase SQL Editor to initialize all tables.
 *   Create users via Supabase Authentication → Users.
 *
 * DO NOT add INITIAL_* or DEFAULT_* arrays back to this file.
 * DO NOT import from this file in any production code path.
 */

export {};
// store.ts is archived. All mock data removed.


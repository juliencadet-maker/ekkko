
# Phase 1c-1a — Bibliothèque assets org-level

Migration finale validée (P2 amendé post-A1/A3/A4). Aucune ligne de code écrite tant que ce plan n'est pas approuvé.

## Décisions actées

| # | Sujet | Tranche |
|---|---|---|
| 1 | RLS pattern | `get_user_org_id(auth.uid())` |
| 2 | `owner_id` | FK `auth.users(id) ON DELETE SET NULL` |
| 3 | `mime_type` | NULLABLE (legacy = NULL, requis applicativement pour nouveaux uploads) |
| 4 | `asset_type` legacy | CHECK strict conservé, mapping fallback `'other'` |
| 5 | `storage_path` | Path Supabase Storage (extraction regex depuis `file_url` legacy) |
| 6 | `archived_at` | Conservé, distinct de `deal_assets.deleted_at` |
| A1 | Compteurs storage | 4 catégories : `public_url`, `signed_url`, `already_relative_path`, `unknown_pattern` |
| A3 | Test RLS cross-org | `BEGIN; ... ROLLBACK;` avec 2 users + 2 orgs, 8 assertions avec preuves SQL |
| A4 | Test regex enrichi | `BEGIN; ... ROLLBACK;` avec 4 fixtures couvrant les 4 patterns |

## Ordre d'exécution

```text
1. Pré-flight (read-only)
   - SELECT file_url FROM deal_assets WHERE deleted_at IS NULL  (calibrer regex)
   - SELECT count(*) FROM orgs WHERE is_demo_org = false        (orgs réelles)
   - SELECT count(*) FROM auth.users                            (users dispo)
   - supabase--linter (baseline warnings)

2. Test enrichi regex storage_path (BEGIN; ... ROLLBACK;)
   - 4 fixtures deal_assets : public URL, signed URL, path relatif, URL externe
   - Exécution backfill DO $$
   - Vérification table : storage_path attendu pour chaque cas
   - Vérification RAISE NOTICE : 4 compteurs cohérents
   - Si un cas KO → STOP, diagnostic avant prod

3. Test RLS cross-org (BEGIN; ... ROLLBACK;)
   - 2 orgs + 2 users + 2 memberships créés en transaction
   - 8 assertions :
     a. user_A SELECT → 1 ligne (son asset)
     b. user_B SELECT → 0 ligne (cross-org isolation)
     c. user_B INSERT dans org_A → ERREUR RLS WITH CHECK
     d. user_B UPDATE asset user_A → 0 ligne affectée
     e. user_A UPDATE son asset → 1 ligne affectée
     f. user_A INSERT dans org_B → ERREUR RLS WITH CHECK
     g. user_A DELETE → ERREUR (pas de policy DELETE)
     h. anonymous SELECT → 0 ligne
   - Preuves SQL brutes (counts, error messages, lignes affectées)

4. Migration réelle (si étapes 2 & 3 passent)
   - Préambule défensif (deal_assets, campaigns, get_user_org_id présents)
   - CREATE TABLE assets (17 colonnes + 5 index)
   - 3 RLS policies (SELECT/INSERT/UPDATE) — pas de DELETE policy
   - ALTER deal_assets ADD COLUMN asset_library_id + index partiel
   - Backfill DO $$ idempotent (WHERE asset_library_id IS NULL)
   - Validation post-migration : 0 orphan attendu

5. Idempotence : 2e exécution → 0 changement (RAISE NOTICE compteurs à 0 sauf déjà migré)

6. Linter Supabase post-migration (diff vs baseline)

7. Tests régression manuels
   - Tracking vidéo, document events, landing Deal Room, voxtral-tts

8. MAJ Notion CODE À JOUR § Phase 1c-1a (diff exact : 1 table, 5 index, 3 policies, 1 colonne pivot, 4 COMMENT)

9. Retour final 4 partenaires avec toutes les preuves
```

## Détails techniques

### Migration SQL principale

Fichier généré par `supabase--migration` :

```sql
-- 0. Préambule défensif (RAISE EXCEPTION si pré-requis manquants)

-- 1. CREATE TABLE public.assets
--    Colonnes : id, org_id, owner_id (FK auth.users ON DELETE SET NULL),
--    name (NOT NULL), asset_type (CHECK whitelist 6 valeurs), purpose,
--    storage_path (NOT NULL), mime_type (NULL), file_size_bytes,
--    tags (TEXT[]), description,
--    last_used_at, last_used_for_company, usage_count (DEFAULT 0),
--    created_via (CHECK whitelist 4 valeurs : web/extension/agent_compositeur/legacy_migration),
--    created_at, updated_at, archived_at

-- 2. Index : org_id, owner_id, (owner_id, last_used_at DESC NULLS LAST),
--    GIN tags, GIN tsvector('french', name+description+purpose)

-- 3. RLS ENABLE + 3 policies via get_user_org_id(auth.uid())
--    SELECT : org_id matche
--    INSERT : org_id matche (WITH CHECK)
--    UPDATE : owner_id = auth.uid() AND org_id matche
--    Pas de policy DELETE (soft-archive via UPDATE archived_at)

-- 4. ALTER deal_assets ADD COLUMN asset_library_id UUID REFERENCES assets(id) ON DELETE SET NULL
--    Index partiel WHERE asset_library_id IS NOT NULL

-- 5. Backfill DO $$
--    Variables compteurs : v_migrated, v_skipped (no org),
--      v_storage_public, v_storage_signed, v_storage_relative, v_unclear_storage,
--      v_other_type
--    Loop : SELECT da.*, c.org_id, c.created_by_user_id WHERE asset_library_id IS NULL AND deleted_at IS NULL
--    Mapping asset_type avec fallback 'other' (ILIKE patterns)
--    Extraction storage_path : 4 cas (public_url, signed_url, already_relative, unknown)
--    Insert assets + UPDATE deal_assets.asset_library_id
--    RAISE NOTICE final avec les 7 compteurs

-- 6. Validation post-migration
--    SELECT count(*) deal_assets actifs avec org_id mais asset_library_id IS NULL
--    RAISE NOTICE OK ou WARNING avec orphan_count
```

### Bloc extraction storage_path (4 cas)

```sql
IF file_url LIKE '%/storage/v1/object/public/%' THEN
  → regex extraction, v_storage_public_count++
ELSIF file_url LIKE '%/storage/v1/object/sign/%' THEN
  → regex extraction, v_storage_signed_count++
ELSIF file_url NOT LIKE 'http%' AND file_url NOT LIKE '//%' THEN
  → garder tel quel, v_storage_relative_count++
ELSE
  → garder tel quel, v_unclear_storage_count++ + RAISE NOTICE
END IF
```

### Mapping asset_type legacy

```sql
CASE
  WHEN da.asset_type IN ('presentation','demo','case_study','whitepaper','video','other') THEN da.asset_type
  WHEN lower LIKE '%present%' THEN 'presentation'
  WHEN lower LIKE '%demo%' THEN 'demo'
  WHEN lower LIKE '%case%' OR LIKE '%client%' THEN 'case_study'
  WHEN lower LIKE '%whitepaper%' OR LIKE '%paper%' THEN 'whitepaper'
  WHEN lower LIKE '%video%' THEN 'video'
  ELSE 'other'  -- + v_other_type_count++ + RAISE NOTICE
END
```

### Test RLS — pattern simulation user

Tentative `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub TO '<uuid>';`. Si Supabase Cloud Lovable n'autorise pas ce pattern hors edge function (PostgREST exécute via JWT, mais en `psql` direct on est superuser), fallback : invocation des fonctions `get_user_org_id(<uuid>)` directement avec UUID hardcodés pour vérifier la logique de filtre, et test d'INSERT/UPDATE en désactivant temporairement le superuser via `SET LOCAL ROLE authenticated`. Si blocage total → arrêt et remontée à toi pour alternative (créer users via signup edge puis tester via edge function dédiée).

### Rollback

```sql
ALTER TABLE deal_assets DROP COLUMN IF EXISTS asset_library_id;
DROP INDEX IF EXISTS idx_deal_assets_library_id;
DROP TABLE IF EXISTS public.assets CASCADE;
```

## Checklist 100% (gate avant retour final)

- [ ] Pré-flight : 4 sanity checks fournis avec sorties brutes
- [ ] Test enrichi regex : 4 patterns validés en BEGIN/ROLLBACK avec table de vérif + RAISE NOTICE
- [ ] Test RLS cross-org : 8 assertions avec preuves SQL (counts, errors, lignes affectées)
- [ ] Migration : table + 5 index + 3 policies + colonne pivot + index partiel + 4 COMMENT
- [ ] CHECK asset_type et created_via testés (INSERT hors whitelist → 23514)
- [ ] FK `ON DELETE SET NULL` testée (DELETE asset → asset_library_id NULL)
- [ ] Idempotence : 2e run = 0 changement
- [ ] Backfill : RAISE NOTICE avec 7 compteurs cohérents
- [ ] Validation post-migration : 0 orphan ou WARNING explicite
- [ ] `src/integrations/supabase/types.ts` régénéré (commit séparé)
- [ ] Aucun fichier intouchable modifié
- [ ] Aucune écriture frontend sur `timeline_events`
- [ ] Régression manuelle : tracking vidéo, doc events, Deal Room, voxtral-tts
- [ ] Linter Supabase : diff baseline vs post (0 nouveau warning, ou justifié)
- [ ] Notion CODE À JOUR § Phase 1c-1a mis à jour avec diff exact

## Périmètre intouchable (rappel)

Aucune modification de : `voxtral-tts`, `transform-script-to-speech`, `tavus-*`, `get-public-video`, `heygen-*`, frontend assets/Deal Room, `timeline_events` (lecture only), edge functions media. Hors scope strict 1c-1b/1c/2/3 (deal_room_version, idempotency_keys, RGPD, asset_tracked_links, agent_compose_sessions, fork v3, feature flags).

## Workflow

1. Tu approuves ce plan (clic "Implement plan").
2. J'exécute dans l'ordre 1→9 avec arrêt immédiat à toute assertion KO.
3. Je reviens avec retour complet : sorties SQL brutes des 3 sandboxes, RAISE NOTICE backfill, diff linter, captures régression, lien Notion mis à jour.
4. ChatGPT audite les preuves, Ju valide, on enchaîne sur P1 Phase 1c-1b.


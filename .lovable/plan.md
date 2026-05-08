# Phase 1c-1a — Clôture + tranchage script_oral

3 actions à livrer après approbation. Aucune ligne de code SQL/TS écrite avant tranchage A/B/C par les partenaires.

---

## Action 1 — MAJ Notion CODE À JOUR § Phase 1c-1a

Ajout d'une nouvelle section dédiée. Contenu exact à pousser via `notion-update-page` :

```text
§ Phase 1c-1a — Bibliothèque assets — VALIDÉE 8 mai 2026

Migrations appliquées :
- 20260508155032_13b49666-649a-4f9e-a307-f0ec696d21cd.sql (Phase 1c-1a — assets library)

Objets DB créés :
- TABLE public.assets (17 colonnes, 4 COMMENT, CHECK asset_type whitelist 6 valeurs, CHECK created_via whitelist 4 valeurs, FK owner_id → auth.users(id) ON DELETE SET NULL)
- INDEX idx_assets_org_id, idx_assets_owner_id, idx_assets_owner_last_used (owner_id + last_used_at DESC NULLS LAST), idx_assets_tags (GIN tags), idx_assets_search (GIN tsvector french : name + description + purpose)
- POLICY "Users can view assets in their org"  (SELECT, get_user_org_id(auth.uid()))
- POLICY "Users can insert assets in their org" (INSERT WITH CHECK, get_user_org_id(auth.uid()))
- POLICY "Owners can update their assets"      (UPDATE, owner_id = auth.uid() AND org_id matche)
- (pas de policy DELETE — soft-archive via UPDATE archived_at)
- TRIGGER trg_assets_updated_at BEFORE UPDATE FOR EACH ROW
  → fonction réutilisée : public.update_updated_at_column() (existante, non modifiée)
- COLUMN public.deal_assets.asset_library_id UUID NULL REFERENCES public.assets(id) ON DELETE SET NULL
- INDEX idx_deal_assets_library_id (partiel WHERE asset_library_id IS NOT NULL)

Backfill exécuté :
- 1 deal_asset migré, 0 skipped
- Compteurs storage : 0 public_url, 0 signed_url, 1 already_relative_path, 0 unknown_pattern
- Compteur asset_type fallback 'other' : 0
- 0 orphan en validation post-migration (deal_assets actifs avec org_id mais asset_library_id NULL)

Idempotence : 2e exécution = 0 ligne migrée (WHERE asset_library_id IS NULL filtre)

Linter Supabase : 18 warnings post = 18 warnings baseline (0 nouveau warning)

Fichiers intouchables non modifiés : voxtral-tts, transform-script-to-speech, tavus-*, get-public-video, heygen-*, frontend assets/Deal Room, timeline_events (lecture only)

Dette acceptée :
- 3/8 assertions RLS formelles (rejets INSERT/UPDATE cross-org via JWT authentifié) reportées Phase 1d (tests E2E playwright)
- Couverture actuelle : 5/8 assertions (SELECT cross-org behavioral + structural diff vs campaigns)
```

---

## Action 2 — MAJ Notion CODE À JOUR § 4 (restructure 4.A / 4.B / 4.C)

Restructuration § 4 conformément au diff Phase 1b acté antérieurement :
- § 4.A — Colonnes ajoutées sur `campaigns` (Phase 1b)
- § 4.B — Colonnes ajoutées sur `deal_assets` (Phase 1b)
- § 4.C — Triggers / fonctions media (Phase 1b — voxtral-tts auth fix)

Le contenu textuel exact sera repris du diff Phase 1b déjà validé. Action exécutée dans le même appel `notion-update-page` qu'Action 1 pour cohérence.

---

## Action 3 — Tranchage script_oral A/B/C (réponse argumentée)

### Recherche code (résultats concrets)

**Lectures `campaigns.script_oral`** :
- `src/pages/NewCampaign.tsx:280-285` — flow facecam : appelle `transform-script-to-speech` puis lit `res.data.script_oral` pour pré-remplir le téléprompteur du `FacecamRecorder`.
- `supabase/functions/tavus-generate-video/index.ts:235` — `const baseScript = (campaign as any).script_oral || campaign.script` → script de base envoyé à Voxtral TTS puis Tavus lip-sync.
- `supabase/functions/process-approval-decision/index.ts:119-125` — lit la réponse de `transform-script-to-speech` (in-memory, pas la colonne directement, mais déclenche l'écriture).

**Écritures `campaigns.script_oral` + `script_oral_generated_at`** :
- `supabase/functions/transform-script-to-speech/index.ts:326-327` — UPDATE direct via service_role.

**Déclencheurs de l'écriture** :
- `process-approval-decision/index.ts:108` (Step 1 du pipeline post-approbation, MANDATORY).
- `NewCampaign.tsx:277` (frontend, flow facecam).

**voxtral-tts** : ne lit/écrit PAS la colonne (commentaire ligne 141 seulement, le script lui est passé en paramètre par `tavus-generate-video`).

### Verdict factuel

**TTS V0 est pleinement active** :
- Pipeline approbation : `process-approval-decision` → `transform-script-to-speech` (écrit `script_oral`) → `tavus-generate-video` (relit `script_oral` comme baseScript pour Voxtral + Tavus).
- Pipeline facecam : `NewCampaign` → `transform-script-to-speech` (écrit `script_oral`) → `FacecamRecorder` (téléprompteur).

→ Option C (mort tranquille) **éliminée** : 4 sites de lecture/écriture actifs en prod.

### Recommandation : **Option B raffinée — Cohabitation par scope disjoint, pas de mirror**

Plutôt qu'un mirror automatique (complexe, source de bugs de désynchro), on sépare les domaines :

| Colonne | Scope canonique | Producteur | Consommateurs |
|---|---|---|---|
| `campaigns.script_oral` | **V0 — Self-campaign / Tavus / Facecam** | `transform-script-to-speech` | `tavus-generate-video`, `NewCampaign` (facecam) |
| `deal_room_version.script_raw_text` + `script_spoken_text` | **V1 — Deal Room compositions multi-versions** | nouveau pipeline 1c-1b (`agent_compositeur`) | `get-public-video-v2`, Deal Room frontend |

**Pourquoi B raffiné plutôt que B mirror** :
1. Les deux domaines ne se croisent jamais : V0 est mono-script par campaign, V1 est multi-version par deal_room. Aucune feature ne demande de lire un script Deal Room V1 depuis le pipeline Tavus V0 (ou inversement).
2. Pas de risque double source de vérité : chaque colonne a un seul producteur et des consommateurs disjoints.
3. Pas de coût migration : `campaigns.script_oral` reste tel quel, aucun refactor des 4 sites V0.
4. Pas de dette : `deal_room_version` est neuf, on peut imposer `script_spoken_text` comme canon V1 dès le départ.

**Action concrète Phase 1c-1b** :
- `COMMENT ON COLUMN campaigns.script_oral IS 'V0 canonical — used by Tavus pipeline & Facecam recorder. Do NOT use for Deal Room V1 (see deal_room_version.script_spoken_text).';`
- `COMMENT ON COLUMN deal_room_version.script_spoken_text IS 'V1 canonical for Deal Room compositions. Do NOT mirror to campaigns.script_oral.';`
- Aucune migration de données rétroactive.

**Pourquoi pas A (deprecated `script_oral`)** : impose de refactorer 4 sites V0 (Tavus, Facecam, NewCampaign, process-approval-decision) en Phase 1c-1b. Hors scope, risque régression Tavus pipeline qui est intouchable jusqu'en Phase 2.

**Pourquoi pas B mirror automatique** : ajoute un trigger PostgreSQL ou une logique edge function pour synchroniser les 2 colonnes. Coût : complexité + bugs latents de désynchro lors d'imports manuels. Bénéfice : nul puisque les consommateurs sont disjoints.

### Question retournée aux 4 partenaires

Validez-vous **Option B raffinée (cohabitation par scope disjoint)** comme tranchage script_oral pour Phase 1c-1b ?

- ☐ Oui → P1 Phase 1c-1b peut être amendé par Claude avec ce tranchage.
- ☐ Non, préférez Option A → besoin d'un go pour refactor V0 (Tavus pipeline touché).
- ☐ Non, préférez Option B mirror automatique → besoin de définir le sens du mirror (V0 → V1, V1 → V0, ou bidirectionnel).

---

## Workflow

1. Vous approuvez ce plan.
2. J'exécute Actions 1 + 2 (1 seul `notion-update-page` — ou 2 si la page est trop grosse).
3. Action 3 : ma recommandation Option B raffinée est livrée par ce plan, j'attends votre tranchage avant tout code Phase 1c-1b.
4. Sur GO tranchage → Claude amende P1 Phase 1c-1b → ChatGPT audit → Ju valide → env-check P1.
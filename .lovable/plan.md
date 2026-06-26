
# 1d.5h-bis-NUKE — Plan d'exécution

Mode meneur D108. Cardinal D120 respecté : aucune logique nouvelle en prod, juste shells + migrations + cleanup + doc.

---

## Réponses aux 10 questions audit terrain

**Q1 — Tables existantes.**
- `signals` : **absente**. Le projet utilise `deal_signals` (signal_type, signal_layer, raw_data, interpretation, confidence). Pas de colonne `subtype` ni `dimension_d106`. → ALTER sur `deal_signals`, pas `signals`.
- `deal_scores` : présente, riche (`des`, `priority_deal_score`, `recommended_action_v2`, `confidence_level`, `trajectory`, `momentum`...). Les 11 ajouts D106 ne dupliquent rien d'existant.
- `assets` : présente, colonne `purpose` (text). `arme_type` n'existe pas → ALTER OK.
- `pending_external_actions` : **absente**. Le projet a `execution_actions` + edge fns `pending-action-create/decide/execute`. Soit on crée la table, soit on ALTER `execution_actions`. **Je propose descope** : `proposed_by` repoussé à 1d.5i-C quand la table cible sera tranchée. Sinon on grave une dette.

**Q2 — Edge functions existantes / Stable Boundaries.** 56 functions dans `supabase/functions/`. STABLE PERMANENT confirmées présentes et UNTOUCHED : `compute-deal-scores`, `transform-script-to-speech`, `voxtral-tts`, `tavus-*` (4), `heygen-*` (4), `get-public-video`, `ingest-video-event`, `check-slack-replies`, `_shared/timeline-events-writer.ts`. ApprovalReview = IN-MIGRATION (hors scope).

**Q3 — Chemins nouveaux docs.** Conforme à `_shared/` existant (qui contient `agent-tools.ts`, `idempotency.ts`, `system-failures.ts`, `timeline-events-writer.ts`, `script-to-speech.ts`) :
- `supabase/functions/_shared/engine-rules-v2c-d106.md`
- `supabase/functions/_shared/agent-tone-guidelines.md`
- `supabase/functions/_shared/agent-tools-v2-d106.ts`

**Q4 — DETTE-12.** Audit fait. Occurrences "Deal Intelligence" en UI :
- `src/pages/CampaignDetail.tsx` L1720 (label TabsTrigger) + L2050 (commentaire) → 2 lignes seulement
- `src/pages/DealIntelligence.tsx` L178 (title) + L92 (console.error)
- `src/components/layout/AppSidebar.tsx` L38 (label nav)
- `src/pages/design/DealRoomMock.tsx` 3 strings
- `src/components/campaign/EkkoAgent.tsx` L9 (commentaire conforme — pas touché)
Minimisation DETTE-12 : sur CampaignDetail, STRICT 2 lignes touchées, hors logique. EkkoAgent zéro touche.

**Q5 — agent-converse — CONFLIT à trancher.** Le brief T6 dit "PAS modifié". MAIS `agent-converse/index.ts` contient L25 + L58 la string `"agent de deal intelligence d'Ekko"` dans 2 system prompts. **Si T5 doit grep "deal intelligence" → 0 résultat**, il faut patcher ces 2 lignes (wording only, logique intacte). Recommandation **patch wording**. Sinon critère D71 T5 échoue mécaniquement.

**Q6 — Migration DB strategy.** Une seule migration atomique via `supabase--migration` (BEGIN/COMMIT implicite). Idempotente : `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` + `DROP POLICY IF EXISTS` avant `CREATE POLICY`. Rollback propre si une CREATE échoue.

**Q7 — Test RLS.** Stratégie : après migration, via `supabase--read_query` faire un SELECT sur chaque nouvelle table avec un user d'org A, vérifier 0 row visible d'org B. Pas besoin d'infra Playwright à ce stade (descopée à 1d.5i-A0).

**Q8 — Risques régression ALTER.** Toutes nouvelles colonnes NULLABLE sans DEFAULT contraignant. `compute-deal-scores` lit/écrit colonnes existantes — il ignorera les nouvelles. CHECK constraints autorisent NULL. Risque résiduel = nul.

**Q9 — UI strings hardcodées.** Liste pré-grep :
- `AppSidebar.tsx` : "Deal Intelligence"
- `CampaignDetail.tsx` : "Deal Intelligence" tab
- `DealIntelligence.tsx` : title
- `DealRoomMock.tsx` : 3 strings
- `agent-converse/index.ts` : 2 system prompts (cf Q5)
Grep exhaustif élargi en début de T5 pour : "campagnes"/"L'IA"/"deals à risque"/"Vue ensemble"/"Tab Vidéo"/"deepfake"/"Mirror Brief"/"silencieux"/"BCG"/"capteur de signal"/"3 features"/"max 2 actions"/"Master Plan 6 avril"/"D88 roadmap"/"communauté Ekko"/"marketplace".

**Q10 — Effort vibe coding.** Grosse phase, structurellement plate. Une passe possible mais je découpe en 4 commits atomiques pour traçabilité et rollback granulaire.

---

## Angles morts identifiés (mode meneur)

1. **`pending_external_actions` n'existe pas en DB.** Le brief T3 assume cette table. Soit le brief vise à la créer (mais alors elle aurait dû être en T2), soit confusion avec `execution_actions`. → **Descope `proposed_by` vers 1d.5i-C**.

2. **FK du brief vs schéma réel.** Brief référence `organizations(id)`, `deals(id)`, `org_members`. Schéma réel : `orgs(id)`, `campaigns(id)`, `org_memberships`. → Toutes les FK seront adaptées : `org_id → orgs(id)`, `deal_id → campaigns(id)`, policies sur `org_memberships`.

3. **Pattern RLS du projet.** Le projet utilise systématiquement `get_user_org_id(auth.uid())` ou subquery sur `org_memberships WHERE user_id = auth.uid() AND is_active = true`. J'aligne les 10 policies sur ce pattern, pas le `org_members` du brief qui pointe table inexistante.

4. **`deal_outcomes` existe déjà**, mais c'est outcome final du DEAL (won/lost). `action_outcomes` = outcome d'un pattern_match → distinction nette, pas doublon.

5. **Conflit T5/T6 sur agent-converse** : tranché en Q5 → patch wording 2 lignes autorisé (pas de logique touchée).

6. **`viewer_hash` dans `account_ecosystem_map`** sans FK vers `viewers` (STABLE PERMANENT) — OK rester text souple.

7. **`account_id` FK sur `accounts`** : table `accounts` existe (vérifié). OK.

---

## Plan d'exécution (4 commits atomiques)

```text
Commit 1 — DB foundation (T2 + T3)
  - 1 migration atomique idempotente
  - 10 CREATE TABLE IF NOT EXISTS + RLS + indexes
  - ALTER deal_signals (dimension_d106 + subtype)
  - ALTER deal_scores (11 colonnes D106, toutes NULLABLE)
  - ALTER assets (arme_type)
  - DESCOPE : pending_external_actions.proposed_by (angle mort 1)
  - Tests RLS via read_query post-migration

Commit 2 — Execution engine shells (T1)
  - 4 shells L2-L5 : pattern-matcher, action-orchestrator,
    asset-generator, outcome-tracker
  - 11 shells complémentaires : ecosystem-mapper, forward-chain-detector,
    unknown-actor-classifier, silent-witness-detector,
    exec-allocation-arbitrator (kebab-case), external-news-fetcher,
    external-people-changes-detector, external-signal-classifier,
    compound-signal-detector, storyline-generator, action-readiness-checker
  - Chaque handler : Deno.serve, CORS, retourne {message:"shell_only"}
  - En-tête : interface TS + commentaire référant règle M27-M40
    + tag "Filled in <session>"
  - Vérif grep : compute-deal-scores untouched

Commit 3 — Documentation (T4 + T6 + T7)
  - _shared/engine-rules-v2c-d106.md (M27-M40)
  - _shared/agent-tone-guidelines.md
  - _shared/agent-tools-v2-d106.ts (25 interfaces + TOOL_REGISTRY)
  - Aucun import side-effect, compilation TS verte

Commit 4 — Cleanup wording obsolète (T5)
  - Grep exhaustif élargi (mapping complet du brief)
  - Fichiers touchés (liste close) :
    * src/components/layout/AppSidebar.tsx (1 ligne — label "Exécution")
    * src/pages/DealIntelligence.tsx (2 lignes — title + console)
    * src/pages/CampaignDetail.tsx (2 lignes — DETTE-12 minimisée)
    * src/pages/design/DealRoomMock.tsx (3 lignes)
    * supabase/functions/agent-converse/index.ts (2 lignes system
      prompts — wording only, logique intacte)
    * + tout fichier remonté par grep élargi (mapping brief)
  - Critère D71 : rg "Deal Intelligence" src/ supabase/ → 0 résultat
  - PAS de renommage route /app/deal-intelligence ni fichier
    DealIntelligence.tsx (legacy URL deeplinks, hors scope D120)

Tag final : 1d5h-bis-nuke-final
```

---

## Décisions à arbitrer AVANT que je code

1. **`pending_external_actions.proposed_by`** : OK descope vers 1d.5i-C ?
2. **agent-converse system prompts** : OK patcher les 2 lignes wording "deal intelligence" → "execution amplifier" ?
3. **Route `/app/deal-intelligence` + fichier `DealIntelligence.tsx`** : on GARDE noms (legacy URL/deeplinks) ? Je recommande oui — rename = scope creep risqué.
4. **Sidebar label "Deal Intelligence"** : nouveau label = "Exécution" ou autre ?
5. **Tests RLS** : tu valides la stratégie read_query post-migration, ou tu fournis les requêtes test ?

Stand-by jusqu'à validation explicite avant Commit 1.

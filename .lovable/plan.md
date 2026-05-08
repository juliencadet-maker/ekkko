## Phase 1e — Sanity Check (avant exécution)

Phase la plus dense du roadmap. Avant tout code, je verrouille **3 zones de risque critiques** + **mémoire phase-1d validée**.

---

### 0. Mémoire à graver d'abord

- `mem://features/phase-1d-deal-room-v15-surface.md` → ajout note **"Validation visuelle JU 8 mai 2026 OK : routing v1/v3 confirmé, prospect view propre"**
- `mem://constraints/no-asset-recreation.md` → upgrade : D67 #8 = scope 1e, pas dette permanente
- Nouveau `mem://constraints/process-approval-decision-untouchable.md` → V0 figé, tout flow V1.5 passe par `submit-deal-room-approval` séparé
- Nouveau `mem://features/phase-1e-deal-room-v15-creation.md` (créé en fin de phase)

---

### 1. Zones de risque (sanity check obligatoire AVANT code)

**R1 — process-approval-decision (V0 INTOUCHABLE)**
- Lecture passive du fichier actuel pour cartographier signatures, side-effects (notifications, audit_logs, video pipeline trigger, slack)
- Création `submit-deal-room-approval` **strictement parallèle** : nouveau handler, nouvelle table de tracking si nécessaire (`deal_room_approval_requests`?) ou réutilisation `approval_requests` avec `approval_type = 'deal_room_v15'`
- **Règle absolue** : zéro `import` croisé, zéro modification de `process-approval-decision/index.ts`. Test grep CI à ajouter.

**R2 — D67 #9 preview vidéo cassée sur deals existants**
- À investiguer **avant** code phase 1e : 
  - vérifier que `AssetLandingPage` (v1) lit bien `campaigns.video_storage_path` ou passe par `deal_rooms`
  - vérifier que `ProspectRoomRouter` ne masque pas un asset existant côté v1 quand flag OFF
  - vérifier `get-public-video` (v1) vs `get-public-video-v3` : deals créés avant 1c-1b ont-ils `deal_room_version` row ?
- Output attendu : 1 paragraphe diagnostic + fix scoped (probablement migration backfill `deal_room_version` depuis `deal_rooms` pour deals legacy, OU fallback v1 sur `deal_rooms` direct)

**R3 — D67 #8 ajout asset sur deal existant (boucle morte ShareDialog)**
- Investiguer `ShareDialog.tsx` actuel : pourquoi "Aucun asset à partager" ?
- Hypothèse : modal lit `deal_assets` filtré sur version active uniquement, sans CTA "créer nouveau"
- Fix scope 1e : ajouter dans `ShareDialog` 2 actions secondaires :
  - "Enregistrer une nouvelle vidéo" → push vers `FacecamRecorder` ou flow agent compositeur
  - "Importer un fichier" → `VideoImportUpload` ou upload document direct vers bucket `deal-videos`
- ⚠️ Doit respecter `mem://constraints/no-asset-recreation` ré-évalué : on lève la contrainte pour deals existants

---

### 2. Scope (11 points → 7 chantiers)

**C1 — NewCampaign refonte 4 étapes** (points 1, 2, 10)
- `src/pages/NewCampaign.tsx` : 4 steps Contexte / Concurrence / Contacts / Asset
- `<CompanyAutocomplete />` nouveau composant, debounce 150ms, query sur `accounts` table (org-scoped) + suggestions externes optionnelles plus tard
- Suppression définitive UI topics calibration côté création
- Vérification grep côté V15Room + AssetLandingPage que topics calibration ne fuite plus prospect-side

**C2 — company_display_name wiring** (point 3)
- Lecture : déjà OK dans `DealRoomGreeting`
- Écriture : NewCampaign step 1 → autocomplete remplit `company_display_name` distinct de `accounts.name`
- Backfill historique : migration SQL `UPDATE campaigns SET company_display_name = COALESCE(company_display_name, (SELECT name FROM accounts WHERE id = account_id))` pour rows existantes

**C3 — Boucle 48h récap** (point 4)
- Migration : `ALTER TABLE campaigns ADD COLUMN draft_state JSONB DEFAULT '{}'::jsonb`
- Edge `send-recap-email` (Resend, template DM Sans, marine, magic link signé 7j)
- Edge `send-recap-cron` (pg_cron toutes les heures, sélectionne deals `status='draft' AND updated_at < now()-48h AND draft_state->>'recap_sent_at' IS NULL`)
- Edge `magic-link-resume` (validate signed token → redirect `/campaigns/new?resume={id}`)
- ⚠️ user-spec cron : utiliser `supabase--insert` (pas migration) car contient projet ref + anon key

**C4 — Agent compositeur autonome 7 étapes** (point 5)
- Edge `agent-transcribe` : Whisper via Lovable AI Gateway (vérifier support, sinon fallback OpenAI direct)
- Edge `agent-compose-deal` : pipeline 7 steps (transcript → extraction contexte → autocomplete account → suggest contacts → générer script → naturalize → save draft)
- State machine `agent_compose_sessions.status` : `idle | transcribing | extracting | composing | naturalizing | ready | failed`
- Cible coût : `google/gemini-3-flash-preview` partout sauf step naturalize (gemini-2.5-pro ponctuel) → estimé < 0.04€/session
- Latence cible 30s : parallélisation steps 2-3-4 (extraction/account/contacts indépendants)

**C5 — wording-validator backend** (point 6)
- `supabase/functions/_shared/wording-validator.ts` : regex strict sur "campagnes", "IA", "intelligence artificielle", "silencieux", "vidéo" (côté prospect output uniquement), labels anglais, emojis
- Intégré dans `agent-compose-deal`, `generate-script`, `forward-magnet-submit` (côté validation prompt user aussi)
- Return `{ ok: false, violations: [...] }` → 422 friendly

**C6 — Flow approbation V1.5 dédié** (point 7) → cf R1
- `submit-deal-room-approval/index.ts` (nouveau)
- Réutilise table `approval_requests` avec discriminant `approval_type = 'deal_room_v15'`
- Notifications via `notify-approval` existant (param-driven, pas de modif)
- Décision UI : nouvelle page `/approvals/deal-room/:id` (pas toucher `/approval/:token` V0)

**C7 — D67 #8 ShareDialog** (point 8) cf R3 ci-dessus

**C8 — D67 #11 wording AE custom "pour avancer sur ce sujet"** (point 11)
- Migration : `ALTER TABLE campaigns ADD COLUMN ae_custom_cta_label TEXT` (max 80 chars, validé par wording-validator)
- UI : champ texte optionnel dans NewCampaign step 4 + édition possible depuis CampaignDetail
- Fallback prospect side : si null → "pour avancer sur ce sujet" hardcoded (comportement actuel inchangé)

---

### 3. Dépendances & ordre d'exécution suggéré

```
R2 (diag preview vidéo) ─┐
                         ├─→ Décision : fix legacy v1 OUI/NON avant tout le reste
R3 (diag ShareDialog)  ─┘

Puis en parallèle :
  ├─ C5 wording-validator (utilitaire pur, 0 dépendance)
  ├─ C2 backfill company_display_name (migration isolée)
  └─ C8 ae_custom_cta_label (migration isolée)

Puis séquentiel :
  ├─ C1 NewCampaign refonte (utilise C2, C8, C5)
  ├─ C7 ShareDialog (utilise composants C1)
  ├─ C4 agent compositeur (utilise C5)
  ├─ C3 boucle 48h récap (utilise C1 draft_state)
  └─ C6 approbation V1.5 (dernier, isolé de V0)
```

---

### 4. Hors scope (rappel)

- Modif `process-approval-decision` V0
- Modif `script_oral` / `script_versions` (V0 intouchable, cf D59/D61)
- PDF tracking page_number/scroll_pct (debt Phase Mega)
- Mirror Brief, mobile native, vidéo interactive
- Génération forward emails LLM avancée
- UI admin flags

---

### 5. Sanity check final attendu (avant GO code)

1. R1 OK : confirmation que `process-approval-decision/index.ts` reste en lecture seule pendant toute la phase
2. R2 diagnostic : 1 paragraphe écrit + plan de fix scoped
3. R3 diagnostic : 1 paragraphe écrit + plan de fix scoped
4. Validation que `agent-transcribe` peut tourner via Lovable AI Gateway (sinon ajout secret Whisper)
5. Validation cron pg_cron actif sur le projet (sinon migration enable extension)
6. Confirmation user qu'on lève partiellement `no-asset-recreation` pour deals existants (D67 #8)

Une fois ces 6 points validés par toi/Claude/JU → GO code C1-C8 dans l'ordre.

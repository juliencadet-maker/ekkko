## Phase 1d — Deal Room V1.5 Surface Prospect

Objectif : livrer la surface prospect V1.5 (8 zones) derrière le feature flag `deal_room_v15`, avec routing v1/v3, soft identify, PDF tracké, Forward Magnet, et durcir les tests E2E Playwright RLS (rattrapage dette 1c).

### Scope (8 zones)

**1. Routing v1/v3 (zone 6)**
- Hook `useDealRoomVersion(orgId)` qui appelle l'edge `is_feature_enabled` (RPC) → résout en `'v1' | 'v3'`
- `prospect/[token]` route : si flag ON → fetch `get-public-video-v3`, sinon `get-public-video` (v1)
- Aucune migration : flag déjà en place (Phase 1c-3)

**2. `<DealRoomIdentification />` (zone 1) — 3 couches D1/D2/D3**
- D1 : token URL → identification implicite (pré-rempli, jamais de prompt)
- D2 : social select (LinkedIn/Email manuel) — pas d'auto-sélection
- D3 : topics neutres affichés en chips, prospect coche 0..n (jamais pré-coché)
- Persistance via `prospect_feedback` (event `identification_layer_completed`)

**3. Soft identify — 5 triggers (zone 2)**
- T1 : 60s de lecture vidéo cumulés
- T2 : click "Télécharger PDF"
- T3 : réaction emoji
- T4 : 2e visite détectée (localStorage `ekko_visit_count_{token}`)
- T5 : `beforeunload` après 30s+ sur la page
- Chaque trigger appelle `prospect-feedback` avec `event_type='soft_identify_trigger'` + cooldown 10s (déjà existant)

**4. `<PdfReaderTracked />` (zone 3)**
- Wrapper PDF.js inline (lib `react-pdf` déjà dispo ou ajout)
- Émet `page_number` + `scroll_pct` à chaque changement (debounce 2s) vers `track-document-events`
- Map sur les 5 doc signals (déjà spécifiés dans `mem://tech/document-tracking-v2`)

**5. Forward Magnet (zone 4)**
- Mini-form `<ForwardMagnetForm />` : prénom + email + rôle (énum D38 : Champion / Décideur / Influenceur / Utilisateur / Autre)
- Anti-spam D56 : avant insert, check `deal_communication_log` pour `recipient_email` identique sur les 24h → si trouvé, retourne 429 friendly
- Edge function `forward-magnet-submit` : insert `recipients` + `deal_communication_log` (channel=`forward`, source=`prospect_room`)

**6. `<DealRoomGreeting />` (zone 5)**
- "Bonjour l'équipe {company_display_name}" si `company_display_name` non null
- Fallback : "Bonjour"
- Tokenize : DM Sans, marine sur ivoire

**7. Perf budget (zone 7)**
- Lazy-load PDF.js + react-pdf via `React.lazy` + `Suspense`
- Code-split routes prospect (`/p/[token]`)
- Vérif post-build : `bun run build` → check `dist/assets/*.js` < 200kb gzip total pour la route prospect
- Pas de polices custom non-utilisées

**8. Tests E2E Playwright RLS (zone 8)**
- Setup minimal Playwright (config + 2 users tenant A/B + service-role helper)
- Rattrapage dette 1c-1a : 3/8 assertions manquantes sur `script_versions`, `script_tokens`, `deal_signals`
- Étend aux 5 tables 1c : `assets`, `deal_room_version`, `asset_tracked_links`, `agent_compose_sessions`, `deal_communication_log`
- Test isolation V1.5 : grep `script_versions` doit rester absent du code rendu pour orgs avec `deal_room_v15=true` (assertion statique sur build output)

### Détails techniques

**Edge function `forward-magnet-submit`**
```ts
// Validation Zod (firstName, email, role enum)
// Anti-spam : SELECT count(*) FROM deal_communication_log WHERE recipient_email=? AND campaign_id=? AND sent_at > now()-interval '24h'
// Si > 0 → 429 + message FR
// Sinon : INSERT recipients + INSERT deal_communication_log
// Return { ok: true }
```

**Hook routing**
```ts
// src/hooks/useDealRoomVersion.ts
const { data } = useQuery(['drv-flag', orgId], async () => {
  const { data } = await supabase.rpc('is_feature_enabled', { p_org_id: orgId, p_flag_name: 'deal_room_v15' });
  return data ? 'v3' : 'v1';
});
```

**Composants nouveaux**
- `src/components/prospect/v15/DealRoomIdentification.tsx`
- `src/components/prospect/v15/DealRoomGreeting.tsx`
- `src/components/prospect/v15/PdfReaderTracked.tsx`
- `src/components/prospect/v15/ForwardMagnetForm.tsx`
- `src/components/prospect/v15/SoftIdentifyTriggers.tsx` (hooks-only, pas de UI)
- `src/pages/prospect/[token]/V15Room.tsx` (orchestrateur)
- `src/hooks/useDealRoomVersion.ts`

**Tests**
- `tests/e2e/rls/` : un fichier par table (8 fichiers)
- `tests/e2e/v15-isolation.spec.ts` : assertion grep
- `playwright.config.ts` racine

### Wording & design tokens
- Strict : aucun "campagnes", "IA", "silencieux", labels anglais, emojis labels, psychologie prospect
- Couleurs : Marine (#0D1B2A), Ivoire (#F7F6F3), Vert Signal (#1AE08A) CTA unique, Amber/Rouge/Bleu badges
- Typo : DM Sans body, Instrument Serif logo only

### Hors scope (rappel)
Mirror Brief, PDF niveau 2/3, vidéo interactive, LLM forward emails, UI admin flags, mobile native, fichiers intouchables (`client.ts`, `types.ts`, `.env`).

### Activation
Tous les orgs restent en `deal_room_v15=false`. Activation manuelle via SQL au cas par cas après recette.

### Sanity check final
1. `bun run build` OK
2. Route `/p/{token}` charge < 200kb gzip pour la portion lazy-loaded prospect
3. Avec flag OFF : v1 inchangé (régression visuelle nulle)
4. Avec flag ON : v3 affiche greeting + identification + PDF tracké + forward
5. Tests Playwright RLS : 8/8 verts
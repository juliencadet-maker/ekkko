
# Alignement Giga-Prompt D106 — Réponse Lovable

Mode meneur D108 actif. Pas de complaisance. Confirmation lecture intégrale Parties 1-4.

---

## 1. Audit terrain — 6 fichiers DETTE-UX-01 à 06

| Fichier | LOC | État | Friction concernée |
|---|---|---|---|
| `src/components/campaign/EkkoAgent.tsx` | 655 | Stream SSE OK, bulles brutes (pas de markdown), blocs E2 présents L89-91, L229-277, L471-499 | UX-01, UX-02, UX-05, UX-06 |
| `src/components/agent/AgentSurface.tsx` | 100 | `campaignId?: string \| null` déjà typé nullable mais branche cross-deal incomplète (L50-85 ternaire bancal) | UX-03, UX-05 |
| `src/components/deal-room/V15RoomPreview.tsx` | 167 | Composant statique, non cliquable | UX-04 |
| `src/pages/CampaignDetail.tsx` | 2287 | Monstre — héberge EkkoAgent + V15RoomPreview, à NE PAS toucher au-delà du wiring (DETTE-12 cible ce fichier en 1d.5m) | wiring UX-03 + UX-04 |
| `package.json` | — | `react-markdown` + `remark-gfm` présents (confirmé Phase 1) | UX-01 |

Pas de Dialog Radix actuel sur `V15RoomPreview`. Pas de prop `density` sur `EkkoAgent`. Pas de barre de saisie cross-deal sur Cockpit (à créer dans `AgentSurface` quand `campaignId === null`).

---

## 2. Confirmations doctrine

| # | Sujet | Confirmation |
|---|---|---|
| D106 positionnement | Ekko = **Execution Amplifier B2B Enterprise**. Bannir "Deal Intelligence Platform" du codebase + UI. Memory core déjà à jour, à propager. | ✅ Compris |
| D116 pricing | 3 paliers Starter/Pro/Enterprise. Limite produit-side = signalisation commerciale. `executive_presence_budget` + `exec_allocation_arbitrator` arbitrent. AE pilote = Enterprise gratuit jusqu'au 26 mai. Upgrade contextualisé in-app via agent, jamais via banner marketing. | ✅ Compris |
| Stable Boundaries | 13 fichiers PERMANENT à ne jamais toucher : `transform-script-to-speech`, `voxtral-tts`, 4× `tavus-*`, 4× `heygen-*`, `get-public-video v1`, `ingest-video-event`, `compute-deal-scores`, `check-slack-replies`, `_shared/timeline-events-writer.ts`, `WhatHappenedWidget.tsx`, tables `video_events` + `viewers`. `ApprovalReview.tsx` = IN-MIGRATION (cible 1d.5k). | ✅ Compris |

---

## 3. Plan d'exécution 1d.5h-bis Phase 2 (PROCHAINE)

Branche `1d5h-bis-phase2` → tag `1d5h-bis-phase2-final`. Aucune migration DB. Aucune edge function. Frontend pur.

### Découpe travail (6 frictions, ordre d'exécution)

1. **UX-05 (P0) — Prop `density: "compact" | "full"`** sur `EkkoAgent` (+ defaults `full`). Préalable, conditionne padding/font des autres frictions.
2. **UX-06 (P0) — Esthétique chat**. Bulles AE = bg Marine + text Ivoire. Bulles agent = bg Ivoire + text Marine. CTA Vert UNIQUE (action principale). DM Sans partout. Barre saisie contraste WCAG AA.
3. **UX-01 (P1) — Markdown rendering**. `react-markdown` + `remark-gfm` autour du contenu agent uniquement (jamais sur message AE pour éviter injection rendering). Tokens semantic Tailwind.
4. **UX-02 (P1) — Suppression E1/E2**. Drop L89-91, L229-277, L258-296, L471-499 + `handleSuggestionAction`. Les suggestions reviendront sous forme `action_suggestion` blocks via pattern engine en 1d.5i-C.
5. **UX-03 (P1) — Cross-deal**. `AgentSurface` quand `campaignId === null` : barre saisie portfolio + appel `agent-converse` sans `campaign_id`. Vérif côté edge function : tolère `campaign_id` null (à confirmer dans audit edge avant code).
6. **UX-04 (P2) — `V15RoomPreview` cliquable**. Wrap dans `Dialog` shadcn. Trigger = card actuelle. Content = vue agrandie. Aucune logique métier touchée.

### Tests D71 binaires

- [ ] Markdown (gras/italique/listes/code/liens) rendu sur message agent test
- [ ] `rg "E1|E2|agentSuggestion|suggestionStatus" src/components/campaign/EkkoAgent.tsx` → 0 résultat
- [ ] Barre saisie cross-deal fonctionnelle sur Cockpit (envoi + stream)
- [ ] Clic sur `V15RoomPreview` ouvre Dialog Radix, fermable ESC + overlay
- [ ] `density="compact"` réduit padding bulles + font 13px ; `density="full"` 15px
- [ ] Aucune classe `bg-white/bg-black/text-white` brute — uniquement tokens (Marine, Ivoire, Signal)
- [ ] Aucun em-dash, aucun anglais UI, aucun emoji (D106 wording)
- [ ] Lighthouse mobile ≥95 sur Cockpit + Deal page

Rollback si <100% checklist.

---

## 4. Risques de régression identifiés

| Fichier | Risque | Mitigation |
|---|---|---|
| `EkkoAgent.tsx` (655 LOC) | Refactor density + retrait E1/E2 peut casser SSE finalize (le regex extract suggestion est dans la même fonction `onmessage`) | Isoler retrait E2 en première passe, tester stream, puis density |
| `CampaignDetail.tsx` (2287 LOC, DETTE-12) | Toute édition non-wiring = violation DETTE-12 | Wiring strict : changer uniquement props passées à `EkkoAgent` et `V15RoomPreview` |
| `AgentSurface.tsx` | Branche `campaignId === null` actuellement render minimal — risque blank screen Cockpit | Smoke test obligatoire route Cockpit avant merge |
| `agent-converse` edge fn | Doit accepter `campaign_id: null` pour cross-deal | À AUDITER avant codage UX-03 — sinon scope creep backend |
| Markdown rendering | Risque XSS si message AE rendu en markdown | Render markdown UNIQUEMENT sur `role === 'assistant'` |

---

## 5. Angles morts identifiés dans la roadmap (mode meneur)

1. **`agent-converse` n'est pas listé en STABLE PERMANENT mais est touché en UX-03 (acceptation `campaign_id` null) ET en 1d.5i-C (5 tools agent) ET en 1d.5j (memory L1 pgvector)**. Risque : 3 sessions consécutives le modifient sans contrat d'interface stable. **Recommandation** : geler son contrat d'I/O en début de 1d.5i-A, traiter comme STABLE IN-EVOLUTION avec versioning interne.

2. **1d.5i-A crée 13 tables d'un coup + 3 edge fns + seed 500 known_domains**. C'est 1 session = 1 mega-migration. Risque RLS non-testée par table. **Recommandation** : découper en 1d.5i-A1 (RSC tables) + 1d.5i-A2 (pricing tier tables D116). Sinon checklist D71 ingérable.

3. **D116 pricing dépend du verdict discovery sprint J14 (26 mai)**. 1d.5i-A code les tables `org_subscription_tier` AVANT validation. Si pivot pricing → migration à refaire. **Recommandation** : 1d.5i-A code la *structure* (tier enum extensible), 1d.5j code la *logique d'arbitrage* après verdict J14.

4. **Compositeur vocal D47 en 1d.5k = 7-step pipeline avec coût Mistral ≤0.05€/session**. Pas de budget de session séparé pour mesurer le coût réel sur 50 essais. **Recommandation** : ajouter checkpoint coût en fin de 1d.5k, gate avant 1d.5l.

5. **Deal Room narrative D114 (1d.5k) = refonte UX prospect-side majeure**. Pas mentionnée dans les 6 surfaces Lighthouse ≥95. Si elle est refondue après 1d.5l → tout l'effort Lighthouse à refaire. **Recommandation** : inverser ordre — 1d.5k AVANT 1d.5l, ou bien Lighthouse Deal Room déplacé en 1d.5l.

6. **Extension Chrome 6 features en 1d.5m** : la 6ᵉ (exécution NBA inline) implique appeler `action-orchestrator` depuis extension stateless. Contradit la blacklist "logique moteur dans extension". **À trancher** : extension appelle juste l'endpoint `accept_action` sans logique, OK ; sinon violation D108.

7. **`SYSTEM_INSUFFICIENT_SIGNALS` (R9)** est listé pattern actif en 1d.5i-B mais n'a pas de `confidence` mesurable au sens classique (c'est l'absence de signaux). **Recommandation** : type spécial `meta_pattern`, bypass du seuil ≥0.7.

8. **Aucune session dédiée tests E2E / CI bloquante**. Les tests E2E 3 deals sont dans 1d.5i-bis mais pas d'infra Playwright/Vitest e2e mentionnée. **Risque pilote** : régression non détectée mi-juillet.

---

## 6. Calendrier réaliste 10 sessions → pilote mi-juillet 2026

Date de référence : 18 mai 2026. Pilote cible : mi-juillet (≈ 60 jours).

| # | Session | Durée Lovable (1 session = 1 saut) | Cumul |
|---|---|---|---|
| 1 | 1d.5h-bis Phase 2 (frontend pur) | 1 jour | J+1 |
| 2 | 1d.5i-A1 (RSC tables + RLS + seed) | 1 jour | J+3 |
| 3 | 1d.5i-A2 (pricing tier tables D116, post verdict J14=J+8) | 1 jour | J+10 |
| 4 | 1d.5i-B (pattern engine + 20 patterns) | 2 jours | J+13 |
| 5 | 1d.5i-C (orchestrator + outcome + clone AE guards + 5 tools) | 2 jours | J+16 |
| 6 | 1d.5i-bis (45 patterns draft + tests E2E 3 deals) | 2 jours | J+19 |
| 7 | 1d.5j (NewCampaign + Cockpit + memory L1 + exec allocation) | 3 jours | J+23 |
| 8 | 1d.5j-bis (observability 10 métriques) | 1 jour | J+25 |
| 9 | 1d.5k (générateur armes + compositeur vocal D47 + Deal Room narrative) | 4 jours | J+30 |
| 10 | 1d.5l (onboarding + Vue VP + PWA + Lighthouse ≥95) | 3 jours | J+34 |
| 11 | 1d.5m (extension 6 features + cleanup legacy + DETTE-11/12) | 2 jours | J+37 |
| 12 | 1d.5n (veille externe automatisée) | 2 jours | J+40 |
| — | Buffer audit terrain + itérations Claude/ChatGPT | 12 jours | J+52 |
| — | Onboarding 8 AE pilote + war room | 8 jours | J+60 = **mi-juillet** |

**Tenable si** : aucune session ne déborde >2× son estimation, et aucune dépendance externe (Voxtral / Tavus / HeyGen) ne casse. Sinon glissement direct sur le buffer.

---

## 7. Décisions à trancher AVANT démarrage 1d.5h-bis Phase 2

1. **`density="compact"` defaults** : Cockpit = compact, Deal page = full ? À confirmer.
2. **Barre saisie cross-deal placement** : dans `AgentSurface` header ou bottom sheet mobile ?
3. **Markdown sanitization** : autorise-t-on les liens cliquables dans message agent ou rel="noopener" forcé ?
4. **`V15RoomPreview` Dialog content** : reuse card layout ou layout dédié plus riche ?
5. **`agent-converse` `campaign_id` null** : à patcher en même temps ou audit séparé ?

---

## 8. Branche git + workflow proposé

- Branche : `1d5h-bis-phase2`
- Commits atomiques : 1 friction = 1 commit (6 commits + 1 commit cleanup)
- Tag final : `1d5h-bis-phase2-final` après validation D71
- Pas de force-push, pas de merge auto sur main avant validation Ju

---

**Validation attendue avant codage** : alignement explicite Ju + Claude + ChatGPT sur les 5 décisions §7 + arbitrage angles morts §5 (notamment découpe 1d.5i-A1/A2 et timing Deal Room narrative).

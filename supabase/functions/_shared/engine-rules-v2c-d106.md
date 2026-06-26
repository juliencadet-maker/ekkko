# RÈGLES MOTEUR EKKO v2c-D106

> Source de vérité moteur Execution Amplifier 5 couches.
> Statut M0-M26 : valides (audit moteur dégelé verdict 85% KEEP). Voir doc historique.
> Statut M27-M40 : déclarées en 1d.5h-bis-NUKE (cette doc), implémentées progressivement de 1d.5i-A1 à 1d.5n.

## Architecture 5 couches (Execution Engine)

- **L1 — `compute-deal-scores`** : STABLE PERMANENT. Signals → scores agrégés + contradictions C1-C10 + DES + priority_deal_score + viewer scoring. INCHANGÉ.
- **L2 — `pattern-matcher`** : Pattern matching sur `best_actions_catalog`.
- **L3 — `action-orchestrator`** : Préparation `pending_external_actions` + arbitrage `exec-allocation-arbitrator`.
- **L4 — `asset-generator`** : Pipeline génération par `arme_type`.
- **L5 — `outcome-tracker`** : Mesure outcomes 7-30j + lifecycle patterns.

Hiérarchie de décision : `pattern_match (conf ≥ 0.7)` > `priority_deal_score` > `DES`.

---

## M27 — Pattern matching (cœur D106)

Tourne dans `pattern-matcher` (L2).
- Lit `best_actions_catalog` (`status='active'` ET `current_stage IN ('experimental','validated','core_pattern')`).
- Pour chaque pattern, évalue trigger_condition sur contexte deal.
- Filtre `confidence ≥ 0.7` (sauf `meta_pattern` avec `bypass_confidence_threshold=true`).
- Filtre par `cooldown_days`.
- Filtre par `contraindications` (hard_blocker / soft_warning / confidence_degrader).
- Output : insert `pattern_matches` avec `status='pending'`.

## M28 — Outcome tracking

Tourne dans `outcome-tracker` (L5), cron nocturne.
- Window 7-30j post-execution.
- Classifier outcome : `positive | neutral | negative | mixed | no_outcome`.
- Update lifecycle (`acceptance_rate`, `total_matches`, `positive_outcomes`, `negative_outcomes`).
- Auto-promotion `experimental → validated` si seuils atteints.
- Auto-downgrade si `negative > 3/5`.

## M29 — Veille externe activation (Source 3)

- IF `external_news_events(account_id, classified_relevance='high', last 30j) > 0` → trigger patterns C1-C6 + EXP3 + P5.
- IF `external_people_changes(account_id, last 60j, change_type IN ('new_hire','role_change')) > 0` → trigger patterns A2-A4.

## M30 — Catalogue community-fed (intra-org D110)

- Workflow 4 stages (D111) : `proposed → experimental → validated → core_pattern`.
- Auto-promotion sur seuils outcomes. JAMAIS validation VP manuelle systématique.

## M31 — Action readiness check

Avant proposer NBA, check `action_readiness_score`.
Si score < seuil → action différée OU action de collecte info à la place.

## M32 — Execution gap surface (Vue VP)

Métrique Vue VP : écart entre patterns matched et patterns exécutés par AE.

## M33 — Political risk override

Si `political_risk_score` > seuil → force qualification AE avant action `strategic`.

## M34 — Differentiation gap surface

Si `differentiation_gap` > seuil → force proposer arme D106 différenciante.

## M35 — VP coaching signal

Alimente Vue VP avec patterns récurrents non exécutés par AE.

## M36 — Silence qualifier check

Avant decay, qualifier le silence :
- `silence_absolute` → decay standard.
- `silence_qualified_after_push` → decay accéléré + alternative.
- `silence_qualified_after_engagement` → maintenir confidence (discussion interne possible).
- `silence_qualified_seasonal` → pas de decay (août, etc.).

## M37 — Compelling event urgency override

Si `compelling_event` avec deadline < 14j → force `action_priority = critical` sur patterns liés.

## M38 — Compound signal force-trigger

Compound signal détecté = trigger immédiat pattern correspondant, sans attendre cycle normal.

## M39 — Storyline narrative generation

Génère narrative à chaque calcul moteur. 3 versions :
- AE-focused : timeline factuelle.
- VP-focused : 30s comprendre le deal.
- Exec-focused : justifier implication exec.

## M40 — Action impact level differentiation

`low / medium / strategic` = garde-fous différenciés.
`strategic` = peut déclencher strategic_fork (D115) OU upgrade signal (D116).

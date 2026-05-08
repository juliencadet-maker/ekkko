
## 1. Confirmation MAJ CODE À JOUR § 4

Restructuration validée et exécutée comme proposée :

- **§ 4.A — État prod actuel (8 colonnes)** : legacy PRÉ-1a + Phase 1a (`clone_status`, `script_oral`, `script_oral_generated_at`, `committee_size_declared`, `deal_value`, etc.)
- **§ 4.B — Ajouts Phase 1b (4 colonnes)** : `identities.audio_source_path`, `campaigns.company_display_name`, `deal_rooms.audio_status`, `deal_rooms.video_status`
- **§ 4.C — Manquants RGPD pour 1c-1b** : `identities.cloning_active`, `profiles.deactivated_at` (à créer)

Page Notion sera mise à jour dès sortie de plan-mode. SAV-006 reste source de vérité projet, intouché.

---

## 2. Arbitrage `campaigns.script_oral` — recherche code

### Audit complet (résultats `rg`)

**Écritures dans la colonne `campaigns.script_oral` :**
- `supabase/functions/transform-script-to-speech/index.ts:326` — UPDATE direct sur `campaigns` après transformation Gemini.
  C'est l'unique writer.

**Lectures de la colonne `campaigns.script_oral` :**
- `supabase/functions/tavus-generate-video/index.ts:235` — `const baseScript = (campaign as any).script_oral || campaign.script;`
  → **Pipeline Tavus actif** consomme cette colonne pour générer la vidéo exec.

**Consommateurs indirects (via réponse HTTP, pas la colonne) :**
- `src/pages/NewCampaign.tsx:280-285` — lit `res.data.script_oral` retourné par la fonction (pas la DB).
- `supabase/functions/process-approval-decision/index.ts:108-124` — appelle `transform-script-to-speech` dans le pipeline d'approbation, consomme la réponse.

**Conclusion factuelle :**
- TTS V0 mentionnée dans la migration du 2 avril **est encore active**.
- `voxtral-tts` ne lit/écrit PAS `script_oral` (commentaire ligne 141 confirme : closing phrase TTS-only, non persistée).
- 1 writer (`transform-script-to-speech`), 1 reader DB (`tavus-generate-video`), branchés ensemble via `process-approval-decision`.

### Verdict : **Scénario A nuancé** (avec frontière claire)

`campaigns.script_oral` n'est **pas** mort (scénario C éliminé). Mais c'est un **pipeline legacy mono-deal** (1 campaign = 1 script exec → 1 vidéo Tavus), qui ne sait pas gérer la logique multi-version Deal Room (versioning, raw vs spoken, prospect-level personalisation).

Ajouter un trigger d'agrégation (scénario B) introduirait un couplage SQL fragile entre deux modèles aux sémantiques différentes (`campaigns.script_oral` = script exec global ; `deal_room_version.script_raw_text` = script versionné par Deal Room). Anti-pattern.

**Recommandation : Scénario A avec frontière sémantique explicite.**

#### Règles à graver en Phase 1c-1b

1. **`campaigns.script_oral`** reste actif **uniquement** pour le pipeline exec/Tavus legacy (genèse mono-script, pas de versioning, pas de Deal Room).
   - Aucun nouveau code ne doit lire/écrire cette colonne.
   - `COMMENT ON COLUMN campaigns.script_oral IS 'LEGACY — Tavus exec pipeline only. New code MUST use deal_room_version.script_raw_text.'`

2. **`deal_room_version.script_raw_text` + `script_spoken_text`** = source canonique pour **tout** flow Deal Room (Phase 1c-2 et au-delà).

3. **Pipeline Tavus** (`tavus-generate-video`) :
   - **Phase 1c** : on ne touche pas, il continue de lire `campaigns.script_oral`.
   - **Phase 1d ou Mega-features** : ticket dédié pour migrer Tavus vers `deal_room_version.script_spoken_text` (la version canonique du script, post-Voxtral). Une fois migré, `campaigns.script_oral` devient supprimable.

4. **`transform-script-to-speech`** : reste tel quel en Phase 1c (il sert encore le pipeline exec). Phase 1e introduira la nouvelle voie via l'agent compositeur écrivant directement dans `deal_room_version.script_raw_text`.

5. **Pas de trigger d'agrégation, pas de mirror.** Les deux colonnes représentent deux concepts différents :
   - `script_oral` = sortie Gemini "transformation orale" stockée au niveau campaign (one-shot).
   - `script_raw_text` = input AE/agent versionné au niveau deal_room.
   - `script_spoken_text` = sortie Voxtral persistée par version.

#### Justification synthétique

| Critère | A (nuancé) | B (mirror) | C (mort) |
|---|---|---|---|
| Aligné code actuel | ✅ Tavus continue | ⚠️ Trigger fragile | ❌ Faux : Tavus lit |
| Risque régression | Nul | Élevé (trigger SQL) | Casse Tavus |
| Anti-pattern double truth | Évité (frontières sémantiques) | Présent (agrégation) | N/A |
| Effort 1c | 1 COMMENT SQL | Trigger + tests | Refacto Tavus immédiate |
| Dette pour Mega-features | Suppression colonne propre | Suppression trigger + colonne | Aucune |

Scénario A nuancé = effort minimal en 1c, dette claire et bornée pour Mega-features.

---

## 3. Actions restantes côté Lovable

- **Action 2** (Voxtral `response_format: "mp3"` direct) : test API réel sur compte Mistral Ekko **avant P1 Phase 1c-2**.
- **Action 3** (modèle STT exact agent compositeur) : test API réel **avant P1 Phase 1e**.

Pas bloquants pour 1c-1a ni 1c-1b.

---

## 4. Prêt pour P1 Phase 1c-1a

Une fois ce plan validé :
- Notion CODE À JOUR § 4 mis à jour (§ 4.A / 4.B / 4.C).
- Décision script_oral = Scénario A nuancé gravée dans la doc Phase 1c-1b.
- Claude peut générer P1 Phase 1c-1a (Bibliothèque assets) — scope confirmé inchangé.

On t'attend sur le go pour exécuter la MAJ Notion + ouvrir P1 Phase 1c-1a.

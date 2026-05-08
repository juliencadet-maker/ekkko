## Phase 1d.5 — Refondation Deal Room multi-assets + Bibliothèque AE

Sanity check avant code. Tranchage data model + cartographie conflits + découpage micro-sessions + 7 questions cadrage.

---

### 0. Diagnostic flash bug R0 "Preview en cours de préparation"

R0 a backfillé `deal_assets` (10 rows) mais **PAS** `deal_room_version`. Or `get-public-video-v3` lit son media depuis `deal_room_version WHERE is_active = true` → renvoie **404 "No active Deal Room version"** sur tous les deals legacy.

Donc côté prospect v3, la vidéo n'apparaît jamais malgré `deal_assets.file_url` valide. C'est cohérent avec le retour Ju : "lien tracké généré OK + deal_assets visible côté AE" mais "preview = en cours de préparation" côté prospect.

**Conséquence pour 1d.5** : la refondation déplace la source de vérité prospect de `deal_room_version` (1=1) vers **`deal_assets` ordonnés** (1=N). Le bug disparaît naturellement → pas de patch isolé à faire.

---

### 1. Tranchage data model — recommandation ferme

**Option A (recommandée)** : enrichir `deal_assets` avec 2 colonnes :
- `display_order INT NOT NULL DEFAULT 0` — index d'affichage prospect
- `block_group TEXT` — slot sémantique (`hero_video` / `documents` / `social_proof` / `roi` / `pricing` / `other`) pour rendu groupé éventuel

**Option B (rejetée)** : nouvelle table `deal_room_blocks` pivot vers `deal_assets`. Surcouche inutile aujourd'hui. Bibliothèque AE pivot déjà en place (`asset_library_id`). Ajouter un 2e pivot = dette.

**Pourquoi A** :
- `deal_assets` porte déjà `campaign_id`, `version_number`, `parent_asset_id`, `asset_library_id`, `asset_purpose`, `tracked_links`. Tout ce qu'il manque = ordre + slot.
- 0 migration de données existantes (juste defaults).
- v3 lit déjà `deal_assets` pour `secondary_assets` → un simple `ORDER BY display_order` suffit.
- UX "réordonner" = `UPDATE display_order` sur 2 lignes. Pas besoin de table dédiée.
- Si plus tard refonte UI Notion-like, on ajoute `deal_room_blocks` SANS casser 1d.5.

**Décision V0 intouchable** : `deal_room_version` **conserve son rôle** pour la vidéo intro générée par pipeline V0/V1.5 (script_naturalized → audio → vidéo Tavus). On la **dénormalise** au moment du publish vers une row `deal_assets` (`asset_purpose='intro'`, `block_group='hero_video'`, `display_order=0`). Comme R0 vient de le faire pour le legacy.

→ Trigger Postgres `AFTER UPDATE ON deal_room_version WHEN NEW.is_active AND NEW.video_status='ready'` qui upsert dans `deal_assets`. Résout aussi le point "futures générations V0 ne peuplent pas deal_assets" (mentionné dans ta vigilance).

---

### 2. Cartographie conflits

**get-public-video-v3 (Phase 1c-3, 273 lignes)** :
- Bloc "active version 404 si manquant" lignes 51-74 → à **alléger** : si pas de `deal_room_version`, on ne retourne plus 404, on continue avec `deal_assets` seulement.
- `secondary_assets.slice(0, 4)` ligne 229 → supprimer le cap, retourner liste complète ordonnée par `display_order`.
- Shape de retour : `secondary_assets` reste, mais devient la liste exhaustive. La vidéo "héro" reste exposée via `video_signed_url` (compat Phase 1d). Possible ajout d'un champ `assets_ordered[]` unifié pour V15Room (1d.5d).
- 90j retention : lecture sur `deal_room_version.created_at`. Pour deals sans version (legacy), basculer sur `campaigns.created_at`.

**Composants Phase 1d (V15Room, DealRoomGreeting, DealRoomIdentification, PdfReaderTracked, ForwardMagnetForm, SoftIdentifyTriggers)** :
- V15Room = adaptation : itère sur `assets_ordered[]` au lieu d'une vidéo + `pdfAssets` filtrés. Chaque asset rendu via switch(asset_type).
- Greeting/Identification/Forward/Soft = aucun changement (n'utilisent pas les assets).
- PdfReaderTracked = aucun changement (déjà multi-instanciable, pris dans `.map`).

**ShareDialog (`src/components/landing/ShareDialog.tsx`, 239 lignes)** :
- Ce composant = "Partager à un collaborateur" (forward d'invitations email). **Ce n'est PAS le ShareDialog cassé** que Ju décrit ("envoyer fichier / importer fichier / refaire vidéo grisés"). Confusion à clarifier.
- Le vrai blocage Ju = absence d'UI "ajouter un asset" sur deal existant dans `CampaignDetail.tsx` (2443 lignes). À investiguer en 1d.5c.

**Pipeline V0 INTOUCHABLE** :
- Aucun fichier V0 (transform-script-to-speech*, voxtral-tts, tavus-*, get-public-video v1, process-approval-decision) **n'est touché**. Le trigger `deal_room_version → deal_assets` est en lecture seule de V0, écriture sur `deal_assets`.
- Si pendant 1d.5 j'identifie un cas où patcher V0 deviendrait nécessaire → STOP immédiat.

**Phase 1c-1a `assets` table org-level** : déjà en place. Pivot `deal_assets.asset_library_id → assets.id` exploitable directement pour la bibliothèque AE (1d.5e). Aucune migration data.

**Phase 1e (C1-C8)** :
- C7 (D67 #1+#2 ShareDialog post-deal) → **supprimé**, absorbé par 1d.5c/1d.5d.
- C4 agent compositeur 7 étapes → bénéficie : compose un Deal Room multi-assets dès la création.
- C1, C2, C3, C5, C6, C8 → inchangés.

---

### 3. Découpage micro-sessions (7 sessions, ordre figé)

```
1d.5a  Data model        +display_order +block_group + index + RLS check
                         + trigger deal_room_version→deal_assets (V0 cache fix)
1d.5b  Backend           get-public-video-v3 multi-assets
                         + edge fns AE: attach/reorder/detach/duplicate-from-library
1d.5c  Frontend AE       CampaignDetail tab "Contenu du deal" → liste assets
                         drag (boutons ↑↓), bouton "Ajouter" (4 sources :
                         enregistrer vidéo / importer fichier / depuis biblio / lien)
1d.5d  Frontend prospect V15Room rendu liste verticale ordonnée par display_order,
                         avec rendu typé (video/pdf/image/link)
1d.5e  Bibliothèque AE   Page /assets : liste org-scoped, recherche, "Réutiliser
                         sur ce deal" (sélection deal cible → POST attach edge fn)
1d.5f  2 surfaces share  Sépare "Deal Room collaborative" (lien long terme,
                         multi-assets) vs "Quick share" (1 asset → lien tracké
                         simple via asset_tracked_links existant)
1d.5g  Best in class     Template Deal Room par défaut à la création
                         (4 slots pré-suggérés : hero_video / documents /
                         social_proof / roi). Tout supprimable/modifiable.
```

Mutualisation possible : 1d.5a + trigger V0 = même migration (1 seule micro-session), évite ticket séparé.

1d.5g peut être livré en même temps que 1d.5c (template = juste pré-création de 4 placeholders dans la liste assets, géré côté frontend AE).

→ **Découpage final proposé : 6 micro-sessions** (a / b / c+g / d / e / f).

---

### 4. Hors scope 1d.5 (renvoyé UX-UI Refonte)

- Drag-and-drop fluide (boutons ↑↓ suffisent pour 1d.5)
- Blocs structurés Notion-like, typage visuel premium
- Templates multiples par vertical
- Bibliothèque avancée (tags / collections / partage entre AEs)
- Page collaborative "vivante" avec commentaires prospect (forward magnet existe, suffit pour 1d.5)
- PDF augmenté niveau 2/3 (debt Phase Mega)

---

### 5. Questions cadrage (7)

1. **Cap nombre d'assets par Deal Room** : aucun, ou plafond souple (ex: 12) pour éviter Deal Rooms infinies côté prospect ?
2. **Suppression asset** : soft delete (`deleted_at`, conserve l'historique tracking) ou hard delete (libère le slot) ?
3. **Ordre par défaut à l'attach** : append en fin de liste, ou push en tête après le hero video ?
4. **Réutilisation depuis bibliothèque** : copie le fichier dans `deal-videos` bucket (isolation deal) ou référence directe via `asset_library_id` (1 fichier source, économie storage) ?
5. **Quick share = surface à part ou bouton dans Deal Room AE ?** (proposition : bouton "Partager rapidement ce contenu" sur chaque ligne asset, génère un `asset_tracked_links` 1-clic, indépendant de la Deal Room collaborative)
6. **Best in class template** : 4 slots vides pré-créés à la création du deal (visibles AE, masqués prospect tant que vide), ou juste suggestions UI sans rows DB ?
7. **Trigger V0 → deal_assets** : on l'inclut dans 1d.5a (corrige les futures générations V0) ou ticket séparé après pilote ?

---

### 6. Ce que je veux entendre avant GO code

1. Validation Option A data model (display_order + block_group sur `deal_assets`)
2. Réponses aux 7 questions cadrage (au moins Q1, Q2, Q4, Q5, Q7)
3. Confirmation découpage 6 micro-sessions (a / b / c+g / d / e / f)
4. Confirmation Phase 1e reprend post-1d.5 avec C7 supprimé, reste inchangé

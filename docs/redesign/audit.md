# Pinto — audit et refonte de l’expérience

Audit mené sur la version 1.0.0 (commit `1f39ffb`) avant toute modification, puis refonte implémentée sur la branche `redesign/product-experience`. Ce document résume ce qui a été trouvé, pourquoi, et ce qui a été décidé.

Méthode : lecture complète du code, puis six audits indépendants sur un instantané figé (parcours UX, états et confiance, accessibilité et UI, inventaire i18n de l’interface, inventaire i18n hors interface, architecture du code). Au total : 485 chaînes visibles hors du système de traduction, 23 constats critiques, 51 élevés.

---

## 1. Le diagnostic en une phrase

Pinto avait un noyau de calcul solide (pur, testé, une seule source pour les valeurs écrites), entouré d’une interface organisée par **fonctionnalités** (six onglets de même rang) plutôt que par **tâche**, d’un système de traduction qui ne couvrait qu’un cinquième de l’interface, et de plusieurs défauts qui pouvaient produire de **mauvais prix** ou des **affirmations non prouvées**.

## 2. Parcours réel pour modifier des prix (avant)

1. Ouvrir le popup → « Open Pinto » ne fait rien si l’onglet était ouvert avant l’installation (aucun message).
2. Configurer un client OAuth en suivant un README non lié depuis l’extension (25 à 35 interactions dans Google Cloud).
3. Saisir parfois le nom de package (deviné depuis la page, mis en cache sans confirmation).
4. Onglet **Prix** : tous les pays sélectionnés **et +10 % déjà armé** à l’ouverture.
5. Pour changer la stratégie : onglet **Stratégie** ou petit lien « +10% ↗ » ; cliquer sur une carte réinitialise ses paramètres.
6. Revenir aux pays, puis « Review changes », saisir le nombre si ≥ 25 pays, appliquer.
7. Résultat : « confirmé en relisant les prix » — alors que rien n’était relu sur le chemin normal.

Ce qu’il fallait mémoriser : l’ordre des onglets, que la stratégie se règle ailleurs que dans le tableau, que les filtres ne réduisent **pas** l’écriture, que « Clear » dans l’historique supprime les points de restauration.

## 3. Constats majeurs

### Prix faux ou affirmations fausses (critiques)
- **Champs numériques** : chaque frappe était reconvertie en nombre puis réaffichée — taper `4.99` donnait `499`, `-20` donnait `+20`, `4,99` donnait `NaN` silencieusement ignoré. Les terminaisons d’arrondi `0,99` devenaient `[0]` (tous les prix en `.00`).
- **Vérification revendiquée sans preuve** : l’écran de résultat affirmait une relecture qui n’avait lieu que sur le chemin d’isolation ; et si cette relecture échouait, tous les pays étaient comptés comme confirmés.
- **Formule `base`** : le prix du pays de référence (ex. 4,99 USD) était écrit tel quel dans toutes les devises (4,99 JPY).
- **Garde-fous « jamais en dessous / au-dessus »** : un seul nombre comparé dans toutes les devises.
- **Changement d’application** : le produit et les prix de l’application précédente restaient en mémoire et pouvaient être écrits dans la nouvelle.
- **Valeurs écrites ≠ valeurs vérifiées** : la table de conversion pouvait être rechargée entre la vérification et l’écriture.
- **« Retry failed », « Undo », « Restore »** écrivaient en un clic, sans revue ni confirmation ; une restauration partielle marquait quand même l’opération comme restaurée.

### Langue (cause racine des « 80 % en anglais »)
1. La détection du navigateur était **écrasée** par la valeur par défaut stockée `locale: 'en'` : un navigateur français obtenait toujours l’anglais.
2. Seuls 5 fichiers d’interface sur 23 utilisaient `t()` ; le dictionnaire comptait ~80 clés, dont 46 pour le guide.
3. Le domaine et le service worker produisaient des **phrases anglaises** (problèmes de prix, erreurs, progression, messages d’opération) — et l’historique les **stockait**.
4. Popup, lanceur dans la Play Console, manifeste, `<html lang>` : jamais localisés.
5. Pas de pluriels (règles anglaises codées en dur), nombres et dates au format du navigateur, noms de pays anglais uniquement (et recherche aussi).

### Expérience
- Six onglets de même rang pour une seule tâche linéaire ; aucun écran ne disait « où suis-je, que puis-je faire, quelle est la suite ».
- Six bandeaux de contrôles avant la première ligne du tableau ; la décision principale (la stratégie) était un lien de 11 px.
- Filtres trompeurs : les pays masqués restaient modifiés.
- États confondus : « aucun produit » affiché pendant le chargement ou après une erreur 403 ; ancien résultat bloquant la revue suivante ; session expirée sans bouton de reconnexion.
- Raccourcis globaux qui volaient la saisie (⌘A, `/`, Échap dans les champs).

### Accessibilité
Lignes `role=checkbox` contenant une seconde case (≈ 300 arrêts de tabulation), panneau fermé encore atteignable au clavier, aucune région live, focus perdu à chaque changement d’écran, 33 textes à 2,6:1 de contraste, une douzaine de contrôles sans nom accessible, glyphes Unicode lus à voix haute.

### Architecture
Store unique de 569 lignes mêlant 9 préoccupations ; composants qui modifiaient le store directement ; liste des stratégies dupliquée dans 8 fichiers ; client API recréé à chaque requête (caches perdus) ; contrat de messages typé d’un seul côté.

## 4. Décisions

### Expérience : une tâche, trois étapes
```
En-tête : Pinto · com.exemple.app                [Historique] [Aide] [Réglages]
Produit : premium · monthly · 1 mois ▾
① Modification   ② Pays   ③ Vérification       ← toujours visibles, résumées
Contenu de l’étape
Pied : « 128 prix vont changer · 2 bloqués »   [Retour]  [Action suivante]
```
- **Modification d’abord** (« comment les prix doivent-ils évoluer ? »), puis **Pays** (« où ? »), puis **Vérification**. Trois étapes, pas un assistant : chaque étape reste cliquable et résumée, l’utilisateur expérimenté enchaîne avec ⌘/Ctrl+↵.
- **Rien n’est pré-armé** : Pinto s’ouvre sur « aucun changement ». La dernière modification et les modèles enregistrés sont proposés, jamais appliqués d’office (une modification relative appliquée deux fois se cumule — c’est signalé).
- **Historique, Aide, Réglages** deviennent des détours accessibles depuis l’en-tête, avec retour.
- **Filtres** : ils changent ce qui est affiché ; si des pays sélectionnés sont masqués, un encadré le dit et propose de ne garder que les pays affichés.
- **Sécurité** : vérification obligatoire, confirmation saisie au-delà de 25 pays, case à cocher pour les variations > 50 %, simulation, restauration avec aperçu (les pays modifiés depuis sont ignorés par défaut), suppression de l’historique confirmée.
- **Format** : le panneau intégré à la Play Console est conservé (point d’entrée à côté du tableau des prix, ancrage gauche/droite, réduction). `chrome.sidePanel` est une alternative sérieuse (ne recouvre pas la page, survit à la navigation, pas de script de contenu requis pour afficher l’UI) mais impose une nouvelle permission et un geste utilisateur pour s’ouvrir depuis la page ; c’est une évolution à évaluer séparément.

### Confiance
- Relecture des prix après **toute** écriture ; statut `unverified` quand la preuve manque ; un succès partiel n’apparaît jamais comme un succès.
- Avant d’écrire, le worker relit le produit et **refuse** si une devise ou un prix a changé depuis la vérification.
- Bissection interrompue sur une erreur non imputable à un pays (quota, session, réseau) au lieu d’accuser chaque pays.
- Verrou : une seule écriture à la fois.

### Internationalisation
- Moteur unique (`src/i18n/core.ts`) : clés typées, paramètres vérifiés à la compilation, pluriels CLDR, balisage en ligne.
- Dictionnaires par domaine fonctionnel, anglais source, français typé contre l’anglais.
- Le domaine et le worker ne produisent plus que des **codes + paramètres** ; `describe.ts` les met en mots. Les anciennes entrées d’historique restent lisibles.
- Formats via `Intl` dans la langue de l’interface ; saisie acceptant `4,99` et `4.99`.
- Préférence `auto | en | fr` partagée par le panneau, le popup et le lanceur, appliquée immédiatement.
- `chrome.i18n` natif pour le manifeste uniquement.

### Architecture du code
- `src/i18n/` (traduction, formats, préférence, présentation du domaine), `src/ui/` (design system), `src/app/store/` (six slices), `src/features/<domaine>/`.
- Ajouter une stratégie : domaine + `features/strategy/model.ts` + dictionnaire ; ajouter une langue : un dossier de dictionnaires, le compilateur liste ce qui manque.

## 5. Garde-fous contre la régression
- Test qui analyse chaque composant et échoue sur tout texte littéral en JSX ou dans un attribut visible.
- Test qui rend chaque écran en français et échoue si une chaîne propre à l’anglais apparaît.
- Tests des dictionnaires : mêmes clés, mêmes paramètres, catégories de pluriel valides, typographie française, pas de copie de l’anglais.
- Contrôle au build : chaque `__MSG_…__` du manifeste existe dans chaque langue, description ≤ 132 caractères.
- Captures de tous les écrans en anglais et en français (`npm run screenshots`).

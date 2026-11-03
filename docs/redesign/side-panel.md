# Pinto dans `chrome.sidePanel` — évaluation

Question : Pinto doit-il quitter la fenêtre qu’il injecte dans la Play Console (iframe dans un shadow root, déplaçable, ancrable, redimensionnable) pour le panneau latéral natif de Chrome ?

> **Décision (novembre 2026) : on garde la fenêtre injectée.** Le panneau latéral apporte du confort (ne pas masquer la page, survivre au rechargement) et du code en moins, mais ne corrige aucun problème qui gêne en pratique : une modification de prix prend quelques minutes, la fenêtre se réduit ou flotte quand elle gêne, et le popup propose déjà de recharger un onglet ouvert avant l’installation. Le prototype a été retiré, permission `sidePanel` comprise, pour ne pas livrer une permission qu’il faudrait justifier au Web Store pour une fonction éteinte.
>
> **À reconsidérer si** des utilisateurs signalent que Pinto masque la Play Console, si Google y ajoute des barres fixes que la fenêtre recouvre, ou si la perte du travail en cours au rechargement devient une plainte. Ce document garde les mesures et la marche à suivre pour reprendre sans tout refaire.

**Conclusion de l’évaluation : faisable, avec un panneau latéral par onglet Play Console.** Mesuré dans Chrome, ce modèle garde tout ce que la fenêtre injectée fait bien (ouverture depuis le lanceur et Maj+P, un Pinto par onglet) et corrige ses trois défauts structurels : il ne masque plus la Play Console, il survit au rechargement de la page, et il fonctionne dans les onglets ouverts avant l’installation. Le coût : une permission sans avertissement et Chrome 116 au minimum.

---

## 1. Ce qui a été construit (puis retiré)

Pour reprendre le sujet, refaire ces changements suffit : ils tenaient en une centaine de lignes. Un prototype qui laissait la fenêtre injectée intacte et ajoute le panneau latéral comme second hôte, choisi par l’indicateur `pinto.panelHost` dans `chrome.storage.local` (`page` par défaut, donc rien ne change tant que la bascule n’est pas décidée ; `side` pour l’essai).

| Fichier | Changement |
| --- | --- |
| `public/manifest.json` | permission `sidePanel` (pas de `side_panel.default_path` : aucun panneau global) |
| `src/background/index.ts` | un panneau **par onglet Play Console** (`sidePanel.setOptions({ tabId, path: 'src/panel/index.html?tab=<id>' })`), désactivé partout ailleurs, y compris pour les onglets ouverts avant l’installation ; `panel/open` → `sidePanel.open({ tabId })` dans le même tour que le message ; contexte diffusé aussi sur navigation interne (`changeInfo.url`) |
| `src/content/index.ts` | lanceur, point d’entrée à côté du tableau des prix et Maj+P envoient `panel/open` quand l’hôte est `side` (l’indicateur est lu à l’avance : le geste ne laisse pas le temps de lire le stockage) |
| `src/app/host.ts` | le panneau sait qu’il est dans le panneau latéral et lit son onglet dans son URL (`?tab=`) — il n’y a pas d’onglet expéditeur |
| `src/app/App.tsx` | Échap ferme le panneau latéral lui-même (`window.close()`) |
| `src/popup/Popup.tsx` | « Ouvrir Pinto » ouvre le panneau latéral, même dans un onglet sans script de contenu |

L’application React et tous ses écrans sont **réutilisés tels quels**. Tests : `tests/backgroundRouter.test.ts` couvre l’ouverture et le refus.

## 2. Mesures

Chrome for Testing 151, l’extension compilée chargée (`dist/`), une page Play Console simulée servie sur les vraies URL (`https://play.google.com/console/…/app/42/subscriptions/premium`, puis `…/app/77/…`), de vrais clics et de vraies touches. Le script de mesure (Playwright : `launchPersistentContext` avec `--load-extension=dist`, `channel: 'chromium'`, routes interceptées sur `https://play.google.com/console/**`, inspection des panneaux par CDP `Target.getTargets`/`attachToTarget`) a été retiré avec le prototype.

| Mesure | Fenêtre injectée | Panneau latéral par onglet |
| --- | --- | --- |
| Ouverture depuis le lanceur dans la page (vrai clic) | ✅ | ✅ `sidePanel.open` accepté : le geste traverse `runtime.sendMessage` |
| Ouverture par Maj+P dans la page | ✅ | ✅ |
| Ouverture sans geste (contrôle) | — | ❌ « `sidePanel.open()` may only be called in response to a user gesture » : le contrôle de Chrome est bien actif |
| Largeur de la Play Console (fenêtre de 1 280 px) | 1 280 px, dont **460 px masqués** | **894 px**, rien de masqué : la page se réorganise |
| Bouton fixe en bas à droite de la page (type « Enregistrer ») | **masqué** | visible |
| Largeur du panneau | 460 px (réglable) | 360 px par défaut, réglable par l’utilisateur (l’interface est vérifiée à 340 px) |
| Rechargement de l’onglet | fenêtre fermée, **état perdu** | même document, **état conservé** |
| Navigation interne de la Play Console | la fenêtre reste sur le produit d’avant | le panneau suit, **état conservé** |
| Deux onglets Play Console (apps #42 et #77) | deux fenêtres indépendantes | **deux panneaux indépendants**, chacun sur son app, chacun avec son état, conservé quand on passe de l’un à l’autre |
| Onglet hors Play Console | — | **aucun panneau** (`enabled: false`) |

## 3. Faits documentés

| Sujet | Fait | Source |
| --- | --- | --- |
| Versions | API `sidePanel` : Chrome 114 ; `sidePanel.open()` : **116** ; `close()` et `onOpened` : 141 ; `onClosed` : 142 ; `getLayout()` : 140 | [référence sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) |
| Ouverture depuis la page | `open()` « may only be called in response to a user action » ; parmi les déclencheurs listés : « A user gesture on an extension page or content script » | [référence sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) |
| Exemple officiel | `cookbook.sidepanel-open` : bouton injecté par un script de contenu → `runtime.sendMessage` → `sidePanel.open({ tabId: sender.tab.id })` dans le service worker ; `minimum_chrome_version` 116 | [chrome-extensions-samples](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/cookbook.sidepanel-open) |
| Condition | le geste n’existe que pendant la distribution du message : `open()` doit être appelé avant toute attente (`await`) — c’est ainsi qu’il est appelé dans le prototype | [messaging (Chromium)](https://github.com/chromium/chromium/blob/main/extensions/renderer/api/messaging/native_renderer_messaging_service.cc) ; cas d’échec dans [w3c/webextensions#521](https://github.com/w3c/webextensions/issues/521) |
| Panneaux par onglet | `setOptions({ tabId, path, enabled })` crée un panneau propre à l’onglet, avec son propre document ; masqué quand l’utilisateur va sur un onglet sans panneau, réaffiché à son retour | [référence sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) |
| Avertissement à l’installation | `sidePanel` n’affiche **aucun avertissement** ; seules les permissions avec avertissement désactivent l’extension mise à jour jusqu’à acceptation : l’ajouter ne désactivera pas Pinto chez les utilisateurs existants | [liste des permissions](https://developer.chrome.com/docs/extensions/reference/permissions-list), [avertissements](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings) |
| URL de l’onglet | les permissions d’hôte suffisent pour lire l’URL des onglets Play Console ; pas besoin de `tabs` | [référence tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs) |
| API disponibles | « As an extension page, side panels have access to all Chrome APIs » (`identity`, `storage`, messages) | [référence sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) |
| Fermeture | `window.close()` dans la page ferme le panneau (avant Chrome 141, la seule façon) | [w3c/webextensions#521](https://github.com/w3c/webextensions/issues/521) |
| Bouton de la barre d’outils | avec `openPanelOnActionClick`, le clic sur l’icône ouvre le panneau **à la place** du popup sur les onglets où un panneau existe | [extension_action_runner.cc (Chromium)](https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/extension_action_runner.cc) |
| Règles du Web Store | un panneau latéral doit « améliorer la tâche en cours » sans distraire ; les panneaux qui détournent la navigation sont interdits. Un panneau limité à la Play Console et ouvert à la demande est dans la règle | [Quality Guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines) |

## 4. Comparaison

**Ce que le panneau latéral apporte**
- **Il ne recouvre plus la Play Console** : la fenêtre ancrée masque 460 px, dont la barre d’enregistrement de Google.
- **Il survit au rechargement** : une modification en cours n’est plus perdue parce que la page a été rechargée.
- **Il fonctionne sans script de contenu** : dans un onglet ouvert avant l’installation ou une mise à jour, l’icône de la barre d’outils ouvre Pinto directement (aujourd’hui, le popup doit proposer de recharger l’onglet). Seule la lecture du nom de package dans la page dépend encore du script de contenu, avec la saisie manuelle en repli.
- **Un Pinto par onglet**, comme aujourd’hui : deux apps dans deux onglets ne se mélangent pas.
- **Moins de code** : la gestion de fenêtre (glisser, ancrer, redimensionner, réduire, bouclier pendant le glissement, mémorisation de la disposition) représente environ 270 lignes de `src/content/ui.ts` et une centaine de lignes de styles. Chrome fournit tout cela, accessible au clavier et au lecteur d’écran.
- **Moins de surface exposée** : la page du panneau n’a plus besoin d’être dans `web_accessible_resources` ni autorisée en `frame-ancestors` pour `play.google.com`. Aujourd’hui, n’importe quelle page de ce domaine peut détecter l’extension en sondant cette URL.

**Ce qu’il coûte**
- **Une permission de plus**, sans avertissement à l’installation. Une justification de plus dans le formulaire de confidentialité du Web Store.
- **Chrome 116 au minimum** (Pinto déclare 114).
- **Largeur par défaut plus étroite** (360 px au lieu de 460) : l’interface tient, le tableau des pays est plus serré. L’utilisateur peut l’élargir ; Chrome mémorise la largeur.
- **La position (gauche/droite) appartient à l’utilisateur**, dans les réglages de Chrome : Pinto ne peut plus proposer ses boutons d’ancrage.

**Ce qui reste à vérifier sur Chrome stable**, faute de pouvoir le prouver ici : le comportement sur la vraie Play Console (la page simulée reproduit ses URL, pas son application), et le premier clic quand le service worker était endormi (la source de Chromium indique que le geste survit au réveil ; aucun test officiel ne le dit).

## 5. Si l’on reprend la bascule

1. **Basculer l’hôte par défaut vers le panneau latéral par onglet**, en gardant le lanceur, le point d’entrée à côté du tableau des prix et Maj+P : ils l’ouvrent.
2. **Passer `minimum_chrome_version` à 116.**
3. **Retirer la fenêtre injectée une version plus tard** (gestion de fenêtre, styles, `web_accessible_resources`, `frame-ancestors`, indicateur `pinto.panelHost`), une fois le panneau latéral éprouvé sur la vraie Play Console.
4. **Mettre à jour** la fiche du Web Store, le formulaire de confidentialité (justification : « afficher l’outil de tarification à côté de la page Play Console qu’il modifie ») et l’aide intégrée (section sur la fenêtre du panneau).


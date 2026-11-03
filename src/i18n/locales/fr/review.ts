import type { Translation } from '@/i18n/core';
import type { review as en } from '../en/review';

//   (espace insécable) avant « : » et dans « »,   (espace fine) avant ; ! ?
export const review: Translation<typeof en> = {
  'review.title': 'Vérifier avant d’appliquer',

  'review.rates.loading.title': 'Récupération des taux de change de Google Play…',
  'review.rates.loading.body': 'Pour que les prix vérifiés soient exactement ceux qui seront appliqués.',
  'review.rates.fallback.title': 'Prix estimés à partir des prix actuels de ce produit',
  'review.rates.fallback.body':
    'Les taux de change de Google n’ont pas pu être chargés ; chaque conversion utilise donc le taux déduit des prix actuels de ce produit. Réessayez pour obtenir les taux exacts.',

  'review.stat.changing': 'Modifiés',
  'review.stat.range': 'Variation',
  'review.stat.rangeValue': '{min} à {max}',
  'review.stat.blocked': 'Bloqués',
  'review.stat.unchanged': 'Inchangés',

  'review.blocked.title': {
    one: '{count} pays est bloqué et ne sera pas modifié',
    other: '{count} pays sont bloqués et ne seront pas modifiés',
  },
  'review.blocked.body': 'Tout le reste s’applique quand même. Chaque ligne bloquée en indique la raison.',
  'review.blocked.show': 'Afficher les pays bloqués',

  'review.check.title': {
    one: '{count} prix est à vérifier',
    other: '{count} prix sont à vérifier',
  },
  'review.check.body':
    'Leur variation est inhabituelle, ou Pinto n’est pas sûr du format de leur devise. Vérifiez-les avant d’appliquer.',
  'review.check.show': 'Les afficher',
  'review.check.confirm': {
    one: 'J’ai vérifié le prix marqué « À vérifier »',
    other: 'J’ai vérifié les {count} prix marqués « À vérifier »',
  },

  'review.subscription.title': 'Les abonnés existants gardent leur prix',
  'review.subscription.body':
    'Les nouveaux prix s’appliquent aux nouveaux abonnés. Les abonnés existants gardent le leur jusqu’à ce que vous les migriez vers le nouveau prix dans la Play Console, qui impose ses propres règles de préavis et de consentement.',

  'review.filter.label': 'Afficher',
  'review.filter.changing': 'Modifiés',
  'review.filter.check': 'À vérifier',
  'review.filter.blocked': 'Bloqués',
  'review.filter.unchanged': 'Inchangés',

  'review.row.price': 'Était à {current}, passe à {next}',
  'review.row.kept': 'Reste à {current}',

  'review.empty.changing.title': 'Aucun prix ne change',
  'review.empty.changing.body':
    'La modification choisie laisse chaque pays sélectionné à son prix actuel.',
  'review.empty.check.title': 'Rien à vérifier',
  'review.empty.check.body': 'Aucun prix ne change d’un montant inhabituel.',
  'review.empty.blocked.title': 'Aucun pays bloqué',
  'review.empty.blocked.body': 'Chaque pays sélectionné a un nouveau prix valide.',
  'review.empty.unchanged.title': 'Tous les prix sélectionnés changent',
  'review.empty.unchanged.body': 'Aucun pays sélectionné ne garde son prix actuel.',

  'review.simulate': 'Simuler',
  'review.simulate.hint':
    'La simulation enregistre l’opération dans l’historique sans rien envoyer à Google Play.',
  'review.apply': { one: 'Appliquer à {count} pays', other: 'Appliquer à {count} pays' },
  'review.confirm.title': {
    one: 'Appliquer {count} nouveau prix ?',
    other: 'Appliquer {count} nouveaux prix ?',
  },
  'review.confirm.body':
    'Pour {product} ({package}). Google Play est mis à jour immédiatement ; vous pourrez ensuite restaurer les prix précédents depuis le résultat ou l’historique.',
  'review.confirm.type': 'Saisissez {number} pour confirmer',

  'review.status.changed': 'Modifié',
  'review.status.unchanged': 'Inchangé',
  'review.status.invalid': 'Bloqué',
  'review.status.skipped': 'Non sélectionné',

  'review.csv.code': 'Code pays',
  'review.csv.country': 'Pays',
  'review.csv.currency': 'Devise',
  'review.csv.current': 'Prix actuel',
  'review.csv.new': 'Nouveau prix',
  'review.csv.change': 'Variation (%)',
  'review.csv.status': 'Statut',
  'review.csv.notes': 'Remarques',
  'review.csv.reason': 'Raison',
  'review.csv.hint': 'Que faire',
  'review.csv.detail': 'Message de Google Play',

  'review.progress.title': 'Mise à jour des prix',
  'review.progress.titleRevert': 'Restauration des prix précédents',
  'review.progress.phase.preparing': 'Lecture des prix actuels',
  'review.progress.phase.writing': {
    one: 'Envoi de {count} prix à Google Play',
    other: 'Envoi de {count} prix à Google Play',
  },
  'review.progress.phase.isolating':
    'Google Play a refusé une partie du lot — recherche des pays concernés',
  'review.progress.phase.verifying': 'Vérification des nouveaux prix sur Google Play',
  'review.progress.rejected': {
    one: '{count} pays refusé pour l’instant',
    other: '{count} pays refusés pour l’instant',
  },
  'review.progress.state.done': 'Terminé :',
  'review.progress.state.current': 'En cours :',
  'review.progress.state.pending': 'À venir :',
  'review.progress.count': '{completed} sur {total}',
  'review.progress.note':
    'Gardez cet onglet ouvert jusqu’à la fin. Vous pouvez parcourir la Play Console en attendant.',

  'review.result.succeeded.title': 'Prix mis à jour',
  'review.result.restored.title': 'Prix précédents restaurés',
  'review.result.succeeded.body': {
    one: '{count} pays confirmé par relecture sur Google Play.',
    other: '{count} pays confirmés par relecture sur Google Play.',
  },
  'review.result.partial.title': {
    one: '{ok} pays sur {count} mis à jour',
    other: '{ok} pays sur {count} mis à jour',
  },
  'review.result.partial.body': {
    one: '{count} pays n’a pas été mis à jour. La raison est indiquée ci-dessous.',
    other: '{count} pays n’ont pas été mis à jour. La raison de chacun est indiquée ci-dessous.',
  },
  'review.result.failed.title': 'Aucun prix n’a été modifié',
  'review.result.failed.body':
    'Google Play n’a pas accepté cette modification. La raison pour chaque pays est indiquée ci-dessous.',
  'review.result.unverified.title': {
    one: 'Google Play a accepté {count} prix, mais Pinto n’a pas pu le relire pour le confirmer',
    other: 'Google Play a accepté {count} prix, mais Pinto n’a pas pu les relire pour les confirmer',
  },
  'review.result.unverified.body':
    'Vérifiez les prix dans la Play Console, ou rechargez ce produit dans quelques minutes pour voir s’ils ont été pris en compte.',
  'review.result.dryRun.title': 'Simulation — rien n’a été envoyé à Google Play',
  'review.result.dryRun.body': {
    one: '{count} prix changerait.',
    other: '{count} prix changeraient.',
  },
  'review.result.reloadHint':
    'La Play Console affiche les anciens prix tant que vous n’avez pas rechargé sa page.',
  'review.result.failures': {
    one: '{count} pays non mis à jour',
    other: '{count} pays non mis à jour',
  },
  'review.result.applyForReal': 'Appliquer réellement',
  'review.result.reviewFailed': 'Revoir les pays en échec',
  'review.result.retryRestore': 'Relancer la restauration',
  'review.result.undo': 'Restaurer les prix',
  'review.result.undo.title': {
    one: 'Restaurer le prix précédent de {count} pays ?',
    other: 'Restaurer les prix précédents de {count} pays ?',
  },
  'review.result.undo.body':
    'Chaque pays retrouve le prix qu’il avait avant cette modification. Google Play est mis à jour immédiatement.',
  'review.result.retry.title': {
    one: 'Relancer la restauration pour {count} pays ?',
    other: 'Relancer la restauration pour {count} pays ?',
  },
  'review.result.retry.body':
    'Ces pays retrouvent le prix qu’ils avaient avant la modification d’origine. Google Play est mis à jour immédiatement.',
  'review.result.restoreConfirm': { one: 'Restaurer {count} prix', other: 'Restaurer {count} prix' },
  'review.result.restoreRow': 'Revient de {current} à {previous}',
};

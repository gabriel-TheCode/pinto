import type { Translation } from '@/i18n/core';
import type { errors as en } from '../en/errors';

export const errors: Translation<typeof en> = {
  'error.generic.title': 'Une erreur est survenue',
  'error.generic.hint':
    'Réessayez. Si le problème persiste, copiez les détails techniques depuis Réglages → Diagnostic.',
  'error.details': 'Détails techniques',

  'error.auth.not-signed-in.title': 'Connexion requise',
  'error.auth.not-signed-in.hint':
    'Connectez-vous avec le compte Google autorisé à modifier les prix de cette application.',
  'error.auth.no-client-id.title': 'Pinto n’est pas encore relié à Google',
  'error.auth.no-client-id.hint': 'Ajoutez votre ID client OAuth, puis connectez-vous.',
  'error.auth.expired.title': 'Votre session a expiré',
  'error.auth.expired.hint': 'Reconnectez-vous pour continuer. Rien n’a été modifié.',
  'error.auth.denied.title': 'Google n’a pas accordé l’accès',
  'error.auth.denied.hint':
    'Reconnectez-vous et autorisez l’API Google Play Developer quand Google le demande.',
  'error.auth.state-mismatch.title': 'La réponse de connexion ne correspond pas à la demande',
  'error.auth.state-mismatch.hint': 'Reconnectez-vous.',
  'error.auth.no-token.title': 'Google n’a renvoyé aucun jeton d’accès',
  'error.auth.no-token.hint': 'Reconnectez-vous.',
  'error.auth.cancelled.title': 'La connexion n’a pas abouti',
  'error.auth.cancelled.hint':
    'Si vous avez fermé la fenêtre, reconnectez-vous. Si Google a affiché une page d’erreur, l’URI de redirection de votre client OAuth ne correspond probablement pas à celui indiqué ici.',
  'error.auth.silent-failed.title': 'Votre session n’a pas pu être renouvelée',
  'error.auth.silent-failed.hint': 'Reconnectez-vous.',

  'error.context.no-package.title': 'Pinto ne sait pas à quelle application correspond cette page',
  'error.context.no-package.hint':
    'Saisissez le nom de package une seule fois : Pinto s’en souvient pour cette application.',

  'error.api.forbidden.title': 'Google Play refuse l’accès à cette application',
  'error.api.forbidden.hint':
    'Vérifiez que l’API Google Play Developer est activée, que votre projet Cloud est associé à ce compte Play Console (Configuration → Accès à l’API) et que votre compte peut modifier les prix.',
  'error.api.not-found.title': 'Google Play ne trouve pas ce produit',
  'error.api.not-found.hint': 'Vérifiez le nom de package et l’existence du produit, puis rechargez.',
  'error.api.network.title': 'Impossible de joindre Google Play',
  'error.api.network.hint': 'Vérifiez votre connexion et réessayez.',
  'error.api.no-answer.title': 'Google Play n’a pas répondu',
  'error.api.no-answer.hint': 'Rechargez pour réessayer.',
  'error.api.bad-response.title': 'Google Play a envoyé une réponse illisible',
  'error.api.bad-response.hint': 'Réessayez dans un instant.',
  'error.api.regions-version.title': '{region} : prix en {got}, et non en {expected}',
  'error.api.regions-version.hint':
    'Un pays a récemment changé de devise. Rechargez les prix et réessayez : Pinto récupère auprès de Google la version actuelle des régions.',
  'error.api.rejected.title': 'Google Play a refusé la modification',
  'error.api.rejected.hint': 'La raison donnée par Google figure dans les détails techniques.',
  'error.api.conflict.title': 'Le produit a changé pendant la mise à jour',
  'error.api.conflict.hint': 'Pinto a rechargé les prix actuels. Vérifiez-les, puis appliquez de nouveau.',
  'error.api.rate-limited.title': 'Google Play limite les requêtes',
  'error.api.rate-limited.hint': 'Patientez une minute, puis réessayez.',
  'error.api.server.title': 'Google Play a rencontré une erreur serveur',
  'error.api.server.hint': 'C’est généralement passager. Réessayez dans un instant.',
  'error.api.http.title': 'Google Play a renvoyé une erreur HTTP {status}',
  'error.api.http.hint': 'La raison donnée par Google figure dans les détails techniques.',
  'error.api.region-not-configured.title': '{region} : pays non disponible pour ce produit',
  'error.api.region-not-configured.hint':
    'Ajoutez d’abord ce pays au produit dans la Play Console, puis définissez son prix avec Pinto.',

  'error.apply.not-applied.title': 'Google a accepté le prix, mais il n’a pas changé',
  'error.apply.not-applied.hint': 'Rechargez les prix et réessayez pour ce pays.',
  'error.apply.rejected.title': 'Google Play a refusé ce prix',
  'error.apply.rejected.hint': 'La raison donnée par Google figure dans les détails techniques.',
  'error.apply.stale.title': {
    one: 'Un prix a changé depuis son chargement',
    other: '{count} prix ont changé depuis leur chargement',
  },
  'error.apply.stale.hint':
    'Ce produit a été modifié entre-temps : aucun prix n’a été appliqué. Pinto a rechargé les prix actuels. Vérifiez-les, puis appliquez de nouveau.',
  'error.apply.busy.title': 'Une autre mise à jour est en cours',
  'error.apply.busy.hint': 'Attendez qu’elle se termine, puis réessayez.',

  'error.history.not-found.title': 'Cette opération n’est plus dans l’historique',
  'error.history.not-found.hint': 'L’historique conserve les 50 dernières opérations.',
  'error.history.no-snapshot.title': 'Aucun prix antérieur à restaurer',
  'error.history.no-snapshot.hint':
    'Seules les opérations appliquées conservent une copie des prix.',

  'error.runtime.disconnected.title': 'Pinto a perdu la connexion avec l’extension',
  'error.runtime.disconnected.hint':
    'L’extension a probablement été mise à jour ou rechargée. Rechargez l’onglet de la Play Console.',
  'error.runtime.no-response.title': 'L’extension ne répond pas',
  'error.runtime.no-response.hint': 'Rechargez l’onglet de la Play Console.',

  'error.preset.invalid-json.title': 'Ce fichier n’est pas un JSON valide',
  'error.preset.invalid-json.hint': 'Choisissez un fichier exporté depuis Pinto.',
  'error.preset.invalid-file.title': 'Ce fichier n’est pas un fichier de modèles Pinto',
  'error.preset.invalid-file.hint': 'Erreur dans {path}. Choisissez un fichier exporté depuis Pinto.',
};

import type { Translation } from '@/i18n/core';
import type { history as en } from '../en/history';

export const history: Translation<typeof en> = {
  'history.loading': 'Chargement de l’historique…',
  'history.empty.title': 'Aucune opération pour l’instant',
  'history.empty.body':
    'Chaque modification appliquée ou simulée est enregistrée ici avec les prix d’avant, pour que vous puissiez les restaurer.',
  'history.note':
    'Historique conservé uniquement sur cet ordinateur. Pinto garde les {max} dernières opérations.',
  'history.day.today': 'Aujourd’hui',
  'history.day.yesterday': 'Hier',

  'history.record.countries': {
    one: '{affected} pays sur {count} mis à jour',
    other: '{affected} pays sur {count} mis à jour',
  },
  'history.record.simulated': {
    one: '{affected} pays sur {count} seraient mis à jour',
    other: '{affected} pays sur {count} seraient mis à jour',
  },
  'history.record.failures': {
    one: '{count} pays non mis à jour',
    other: '{count} pays non mis à jour',
  },

  'history.restore.action': 'Restaurer les prix précédents',
  'history.restore.undoRestore': 'Annuler cette restauration',
  'history.restore.title': 'Restaurer les prix précédents ?',
  'history.restore.description': '{product} : retour aux prix d’avant l’opération du {when}.',
  'history.restore.confirm': { one: 'Restaurer {count} prix', other: 'Restaurer {count} prix' },
  'history.restore.col.country': 'Pays',
  'history.restore.col.now': 'Actuel',
  'history.restore.col.restored': 'Restauré',
  'history.restore.row.skipped': 'Modifié depuis · ignoré',
  'history.restore.row.overwritten': 'Modifié depuis · écrasé',
  'history.restore.drift.title': {
    one: '{count} pays modifié depuis cette opération',
    other: '{count} pays modifiés depuis cette opération',
  },
  'history.restore.drift.body':
    'Leur prix n’est plus celui laissé par cette opération : il a été modifié ensuite, dans Pinto ou dans la Play Console. Ces pays sont ignorés pour conserver cette modification ultérieure.',
  'history.restore.drift.include': {
    one: 'Écraser aussi le pays modifié depuis',
    other: 'Écraser aussi les {count} pays modifiés depuis',
  },
  'history.restore.noCheck':
    'Cette opération est antérieure à la détection des modifications ultérieures. Comparez les prix actuels avant de restaurer.',
  'history.restore.nothing':
    'Tous les pays ont été modifiés depuis cette opération : il n’y a rien à restaurer, sauf si vous les écrasez.',
  'history.restore.typePrompt': 'Saisissez {count} pour confirmer',
  'history.restore.otherApp.title': 'Cette opération portait sur {package}',
  'history.restore.otherApp.body':
    'Ce n’est pas l’application ouverte : les prix sont restaurés dans cette application-là, pas dans celle-ci.',
  'history.restore.otherProduct.title': {
    one: '{count} prix sera restauré',
    other: '{count} prix seront restaurés',
  },
  'history.restore.otherProduct.body':
    'Ce produit n’est pas celui qui est ouvert : Pinto ne peut donc pas afficher ses prix actuels ici. Chaque pays reprend son prix précédent, y compris ceux modifiés depuis.',
  'history.restore.otherProduct.open': 'Ouvrir ce produit pour comparer',

  'history.clear.action': 'Effacer l’historique',
  'history.clear.title': 'Effacer tout l’historique ?',
  'history.clear.body': {
    one: 'L’opération et son point de restauration seront supprimés définitivement. Vous ne pourrez plus restaurer les prix qu’elle a modifiés.',
    other: 'Les {count} opérations et leurs points de restauration seront supprimés définitivement. Vous ne pourrez plus restaurer les prix qu’elles ont modifiés.',
  },
  'history.clear.confirm': 'Effacer l’historique',
  'history.cleared': 'Historique effacé',
};

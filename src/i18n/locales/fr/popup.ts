import type { Translation } from '@/i18n/core';
import type { popup as en } from '../en/popup';

export const popup: Translation<typeof en> = {
  'popup.checking': 'Vérification de l’onglet…',

  'popup.account': 'Compte',
  'popup.account.signedIn': 'Connecté',
  'popup.account.signedOut': 'Non connecté',
  'popup.tab': 'Cet onglet',
  'popup.tab.pricing': 'Page de prix',
  'popup.tab.console': 'Play Console, hors page de prix',
  'popup.tab.other': 'Hors Play Console',
  'popup.app': 'Application',

  'popup.open': 'Ouvrir Pinto',
  'popup.consoleHint':
    'Ouvrez un abonnement, un produit ponctuel ou la page de prix de l’application : Pinto la détecte automatiquement.',
  'popup.otherHint': 'Pinto modifie les prix depuis la Play Console.',
  'popup.shortcut.mac': 'Sur une page de prix, vous pouvez aussi appuyer sur <kbd>⇧P</kbd>.',
  'popup.shortcut.other': 'Sur une page de prix, vous pouvez aussi appuyer sur <kbd>Maj+P</kbd>.',

  'popup.stale.title': 'Rechargez cet onglet pour terminer l’installation de Pinto',
  'popup.stale.body': 'Cet onglet était ouvert avant l’installation ou la mise à jour de Pinto.',
  'popup.stale.action': 'Recharger l’onglet',
};

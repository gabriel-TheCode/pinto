import type { Translation } from '@/i18n/core';
import type { settings as en } from '../en/settings';

export const settings: Translation<typeof en> = {
  'settings.language.title': 'Langue',
  'settings.language.description':
    'S’applique partout dans Pinto : ce panneau, la fenêtre de l’extension dans la barre d’outils et le bouton Pinto des pages de la Play Console. Google Play garde sa propre langue.',
  'settings.language.label': 'Langue d’affichage',
  'settings.language.auto': 'Automatique',
  'settings.language.browser': 'Suit la langue de votre navigateur : {language}.',

  'settings.account.title': 'Compte',
  'settings.account.token':
    'Votre jeton d’accès est valide jusqu’à {time} et se renouvelle automatiquement. Il est conservé en mémoire pour cette session du navigateur uniquement, jamais sur le disque.',
  'settings.account.signOut': 'Se déconnecter',

  'settings.app.title': 'Cette application',
  'settings.app.description': 'Pinto lit et écrit les prix uniquement pour ce nom de package.',
  'settings.app.package': 'Nom de package',
  'settings.app.invalid':
    'Saisissez le nom de package de l’application, par exemple com.example.app : lettres minuscules, chiffres et tirets bas, en au moins deux parties séparées par des points.',
  'settings.app.source.page': 'Lu sur la page de la Play Console : vérifiez qu’il s’agit de la bonne application.',
  'settings.app.source.cache': 'Mémorisé sur cet ordinateur pour cette application.',
  'settings.app.source.manual': 'Saisi par vous.',
  'settings.app.source.url': 'Lu dans l’adresse de la page.',
  'settings.app.consoleId': 'ID de l’application dans la Play Console : {id}.',
  'settings.app.noConsoleId': 'Ouvrez une application dans la Play Console pour changer son nom de package.',
  'settings.app.saved': 'Nom de package enregistré : {package}',

  'settings.cloud.title': 'Connexion Google Cloud',
  'settings.cloud.description': 'Pinto se connecte via un client OAuth de votre propre projet Google Cloud.',
  'settings.cloud.clientId': 'ID client OAuth',
  'settings.cloud.placeholder': '1234567890-abc.apps.googleusercontent.com',
  'settings.cloud.invalid': 'Un ID client OAuth se termine par .apps.googleusercontent.com.',
  'settings.cloud.hint': 'Enregistrer un autre ID client vous déconnecte.',
  'settings.cloud.confirmTitle': 'Changer l’ID client OAuth ?',
  'settings.cloud.confirmBody':
    'Votre session sera fermée, puis vous vous reconnecterez via le nouveau client. Vos modèles et votre historique sont conservés.',
  'settings.cloud.confirm': 'Enregistrer et se déconnecter',
  'settings.cloud.redirect': 'URI de redirection autorisé',
  'settings.cloud.redirectHint': 'Ajoutez-le tel quel à votre client OAuth dans Google Cloud.',
  'settings.cloud.copyRedirect': 'Copier l’URI',

  'settings.storage.title': 'Ce que Pinto conserve',
  'settings.storage.machine':
    'Sur cet ordinateur : votre ID client OAuth, vos réglages (dont la dernière modification appliquée), vos modèles et groupes, l’historique de vos 50 dernières opérations avec les prix avant et après chacune, le nom de package associé à chaque application de la Play Console, un journal technique, et la position de la fenêtre du panneau.',
  'settings.storage.session':
    'En mémoire, pour cette session du navigateur uniquement : le jeton d’accès, ainsi que votre nom, votre adresse e-mail et votre photo.',
  'settings.storage.nowhere':
    'Nulle part ailleurs. Pinto n’a pas de serveur : les prix vont directement de ce panneau à l’API Google Play Developer.',

  'settings.log.title': 'Diagnostic',
  'settings.log.description':
    'Un journal technique de ce que Pinto a fait, à joindre à un signalement de bug. Ses lignes sont techniques et restent en anglais.',
  'settings.log.load': 'Charger le journal technique',
  'settings.log.label': 'Journal technique',
  'settings.log.empty': 'Le journal est vide.',
  'settings.log.copy': 'Copier le journal',

  'settings.keys.title': 'Raccourcis clavier',
  'settings.keys.shortcut': 'Raccourci',
  'settings.keys.action': 'Action',
  'settings.keys.toggle': 'Ouvrir ou fermer Pinto sur une page de la Play Console',
  'settings.keys.search': 'Rechercher un pays',
  'settings.keys.selectAll': 'Sélectionner tous les pays affichés',
  'settings.keys.next': 'Continuer, ou appliquer à l’étape Vérification',
  'settings.keys.close': 'Fermer une boîte de dialogue, ou le panneau',
  'settings.keys.shift': 'Maj',
  'settings.keys.esc': 'Échap',

  'settings.about.title': 'À propos de {app}',
  'settings.about.version': 'Version {version}',
};

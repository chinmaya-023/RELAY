const messages = {
  'auth/weak-password': 'Choose a stronger password that meets your workspace requirements.',
  'auth/too-many-requests': 'Too many attempts were made. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'We could not reach the authentication service. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Please allow pop-ups and try again.',
  'auth/account-exists-with-different-credential': 'This email is already linked to a different sign-in method. Please use the method you used previously.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for this workspace.'
};

export const authMessage = (error, fallback = 'We could not complete that request. Please try again.') => messages[error?.code] ?? fallback;

const messages = {
  'auth/email-already-in-use': 'We could not create an account with these details. If you already have a Relay account, sign in or reset your password.',
  'auth/email-exists': 'We could not create an account with these details. If you already have a Relay account, sign in or reset your password.',
  'auth/weak-password': 'Choose a stronger password that meets your workspace requirements.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts were made. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'We could not reach the authentication service. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Please allow pop-ups and try again.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled. Please try again.',
  'auth/unauthorized-domain': 'This website domain is not authorized for sign-in. Please contact the workspace owner.',
  'auth/unauthorized-continue-uri': 'This website domain is not authorized for verification emails. Please contact the workspace owner.',
  'auth/invalid-continue-uri': 'The verification-email return URL is invalid. Please contact the workspace owner.',
  'auth/invalid-api-key': 'Authentication configuration is invalid for this deployment. Please contact the workspace owner.',
  'auth/account-exists-with-different-credential': 'This email is already linked to a different sign-in method. Please use the method you used previously.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for this workspace.'
};

export const authMessage = (error, fallback = 'We could not complete that request. Please try again.') => messages[error?.code] ?? fallback;

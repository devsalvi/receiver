import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const POOL_ID = import.meta.env.VITE_COGNITO_POOL_ID || 'us-east-1_AntyLz5r2';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '24sdog41lofq4r17qg5n542rbe';

const userPool = new CognitoUserPool({
  UserPoolId: POOL_ID,
  ClientId: CLIENT_ID,
});

// Sign in — handles normal login and forced password change
export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve(extractSession(session));
      },
      onFailure: (err) => reject(err),
      newPasswordRequired: (userAttributes) => {
        reject({ code: 'NewPasswordRequired', userAttributes, cognitoUser });
      },
    });
  });
}

// Complete new password challenge (first login for admin-created users)
export function completeNewPassword(cognitoUser, newPassword) {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => {
        resolve(extractSession(session));
      },
      onFailure: (err) => reject(err),
    });
  });
}

function extractSession(session) {
  const payload = session.getIdToken().payload;
  const groups = payload['cognito:groups'] || [];
  return {
    idToken: session.getIdToken().getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    storeId: payload['custom:store_id'],
    storeName: payload['custom:store_name'],
    email: payload.email,
    isSuperAdmin: groups.includes('super_admin'),
  };
}

// Sign out
export function signOut() {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}

// Get current session (auto-refreshes tokens)
export function getCurrentSession() {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser();
    if (!user) return reject(new Error('No user'));

    user.getSession((err, session) => {
      if (err || !session.isValid()) return reject(err || new Error('Invalid session'));
      resolve(extractSession(session));
    });
  });
}

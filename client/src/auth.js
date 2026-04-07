import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

const POOL_ID = import.meta.env.VITE_COGNITO_POOL_ID || 'us-east-1_AntyLz5r2';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '24sdog41lofq4r17qg5n542rbe';

const userPool = new CognitoUserPool({
  UserPoolId: POOL_ID,
  ClientId: CLIENT_ID,
});

// Sign up a new store owner
export function signUp(email, password, storeName) {
  return new Promise((resolve, reject) => {
    const storeId = `store_${crypto.randomUUID().slice(0, 12)}`;
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'custom:store_id', Value: storeId }),
      new CognitoUserAttribute({ Name: 'custom:store_name', Value: storeName }),
    ];

    userPool.signUp(email, password, attributes, null, (err, result) => {
      if (err) return reject(err);
      resolve({ user: result.user, storeId });
    });
  });
}

// Confirm sign up with verification code
export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// Sign in
export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          storeId: session.getIdToken().payload['custom:store_id'],
          storeName: session.getIdToken().payload['custom:store_name'],
          email: session.getIdToken().payload.email,
        });
      },
      onFailure: (err) => reject(err),
      newPasswordRequired: (userAttributes) => {
        // For admin-created users that need to set a new password
        reject({ code: 'NewPasswordRequired', userAttributes, cognitoUser });
      },
    });
  });
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
      resolve({
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        storeId: session.getIdToken().payload['custom:store_id'],
        storeName: session.getIdToken().payload['custom:store_name'],
        email: session.getIdToken().payload.email,
      });
    });
  });
}

// Resend confirmation code
export function resendConfirmation(email) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

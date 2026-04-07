import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { provisionStore } from '../db/store.js';

const COGNITO_POOL_ID = process.env.COGNITO_POOL_ID || 'us-east-1_AntyLz5r2';
const COGNITO_REGION = process.env.COGNITO_REGION || 'us-east-1';
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_POOL_ID}`;
const JWKS_URI = `${COGNITO_ISSUER}/.well-known/jwks.json`;

const client = jwksClient({ jwksUri: JWKS_URI, cache: true, rateLimit: true });

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// Verify Cognito JWT and extract store_id
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);

  jwt.verify(token, getKey, { issuer: COGNITO_ISSUER }, (err, decoded) => {
    if (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const storeId = decoded['custom:store_id'];
    const storeName = decoded['custom:store_name'] || 'My Barber Shop';
    const email = decoded.email;

    if (!storeId) {
      return res.status(403).json({ error: 'No store associated with this account' });
    }

    // Auto-provision store on first login
    provisionStore(storeId, storeName, email);

    req.storeId = storeId;
    req.userEmail = email;
    req.storeName = storeName;
    next();
  });
}

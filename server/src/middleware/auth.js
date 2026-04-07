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

// Base JWT verification — sets req.userEmail, req.groups
function verifyToken(req, res) {
  return new Promise((resolve, reject) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return reject();
    }

    const token = authHeader.slice(7);

    jwt.verify(token, getKey, { issuer: COGNITO_ISSUER }, (err, decoded) => {
      if (err) {
        console.error('JWT verification failed:', err.message);
        res.status(401).json({ error: 'Invalid or expired token' });
        return reject();
      }

      req.userEmail = decoded.email;
      req.groups = decoded['cognito:groups'] || [];
      req.decoded = decoded;
      resolve(decoded);
    });
  });
}

// Require authenticated store admin — extracts store_id and auto-provisions
export function requireAuth(req, res, next) {
  verifyToken(req, res)
    .then((decoded) => {
      const storeId = decoded['custom:store_id'];
      const storeName = decoded['custom:store_name'] || 'My Barber Shop';

      if (!storeId) {
        // Super admins don't have a store_id — block them from store routes
        if (req.groups.includes('super_admin')) {
          return res.status(403).json({ error: 'Super admins must use admin endpoints' });
        }
        return res.status(403).json({ error: 'No store associated with this account' });
      }

      // Auto-provision store on first login
      provisionStore(storeId, storeName, decoded.email);

      req.storeId = storeId;
      req.storeName = storeName;
      next();
    })
    .catch(() => {});
}

// Require super admin — checks for super_admin group
export function requireSuperAdmin(req, res, next) {
  verifyToken(req, res)
    .then(() => {
      if (!req.groups.includes('super_admin')) {
        return res.status(403).json({ error: 'Super admin access required' });
      }
      next();
    })
    .catch(() => {});
}

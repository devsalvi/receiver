import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminSetUserPasswordCommand,
  ListUsersInGroupCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import db from '../db/index.js';
import { provisionStore } from '../db/store.js';
import { createAgent, deleteAgent } from '../services/elevenlabs.js';

const router = Router();

const POOL_ID = process.env.COGNITO_POOL_ID || 'us-east-1_AntyLz5r2';
const REGION = process.env.COGNITO_REGION || 'us-east-1';

const cognito = new CognitoIdentityProviderClient({ region: REGION });

// List all stores
router.get('/stores', (req, res) => {
  const stores = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM appointments WHERE store_id = s.id) as appointment_count,
      (SELECT COUNT(*) FROM customers WHERE store_id = s.id) as customer_count,
      (SELECT COUNT(*) FROM calls WHERE store_id = s.id) as call_count
    FROM stores s ORDER BY s.created_at DESC
  `).all();
  res.json(stores);
});

// Get single store
router.get('/stores/:id', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  const services = db.prepare('SELECT * FROM services WHERE store_id = ? AND active = 1').all(req.params.id);
  const barbers = db.prepare('SELECT * FROM barbers WHERE store_id = ? AND active = 1').all(req.params.id);
  const stats = {
    appointments: db.prepare('SELECT COUNT(*) as count FROM appointments WHERE store_id = ?').get(req.params.id).count,
    customers: db.prepare('SELECT COUNT(*) as count FROM customers WHERE store_id = ?').get(req.params.id).count,
    calls: db.prepare('SELECT COUNT(*) as count FROM calls WHERE store_id = ?').get(req.params.id).count,
  };

  res.json({ ...store, services, barbers, stats });
});

// Create a new store + admin user
router.post('/stores', async (req, res) => {
  const { store_name, admin_email, admin_password } = req.body;

  if (!store_name || !admin_email || !admin_password) {
    return res.status(400).json({ error: 'store_name, admin_email, and admin_password are required' });
  }

  if (admin_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const storeId = `store_${uuid().slice(0, 12)}`;

  try {
    // Create Cognito user with store attributes
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: POOL_ID,
      Username: admin_email,
      TemporaryPassword: admin_password,
      UserAttributes: [
        { Name: 'email', Value: admin_email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:store_id', Value: storeId },
        { Name: 'custom:store_name', Value: store_name },
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
    }));

    // Provision the store in the database
    provisionStore(storeId, store_name, admin_email);

    // Create ElevenLabs voice agent for this store
    let agentId = null;
    try {
      const webhookBaseUrl = process.env.ELEVENLABS_WEBHOOK_URL || `http://32.194.173.32`;
      const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
      const services = db.prepare('SELECT * FROM services WHERE store_id = ? AND active = 1').all(storeId);
      const barbers = db.prepare('SELECT * FROM barbers WHERE store_id = ? AND active = 1').all(storeId);

      const agent = await createAgent(store, services, barbers, webhookBaseUrl);
      agentId = agent.agent_id;
      db.prepare('UPDATE stores SET elevenlabs_agent_id = ? WHERE id = ?').run(agentId, storeId);
      console.log(`ElevenLabs agent created for store ${storeId}: ${agentId}`);
    } catch (err) {
      console.error('ElevenLabs agent creation failed (store still created):', err.message);
    }

    res.status(201).json({
      store_id: storeId,
      store_name,
      admin_email,
      elevenlabs_agent_id: agentId,
      message: `Store created. Admin can log in with email: ${admin_email} and the temporary password. They will be prompted to change it on first login.`,
    });
  } catch (err) {
    console.error('Failed to create store:', err);

    if (err.name === 'UsernameExistsException') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    res.status(500).json({ error: err.message || 'Failed to create store' });
  }
});

// Delete a store (removes Cognito user + DB data)
router.delete('/stores/:id', async (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  // Delete ElevenLabs agent
  if (store.elevenlabs_agent_id) {
    try {
      await deleteAgent(store.elevenlabs_agent_id);
    } catch (err) {
      console.error('Failed to delete ElevenLabs agent:', err.message);
    }
  }

  // Delete Cognito user
  try {
    await cognito.send(new AdminDeleteUserCommand({
      UserPoolId: POOL_ID,
      Username: store.owner_email,
    }));
  } catch (err) {
    if (err.name !== 'UserNotFoundException') {
      console.error('Failed to delete Cognito user:', err);
    }
  }

  // Delete store data
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM reminders WHERE appointment_id IN (SELECT id FROM appointments WHERE store_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM sms_logs WHERE store_id = ?').run(req.params.id);
    db.prepare('DELETE FROM calls WHERE store_id = ?').run(req.params.id);
    db.prepare('DELETE FROM appointments WHERE store_id = ?').run(req.params.id);
    db.prepare('DELETE FROM customers WHERE store_id = ?').run(req.params.id);
    db.prepare('DELETE FROM business_hours WHERE store_id = ?').run(req.params.id);
    db.prepare('DELETE FROM services WHERE store_id = ?').run(req.params.id);
    db.prepare('DELETE FROM barbers WHERE store_id = ?').run(req.params.id);
    db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
  });
  txn();

  res.json({ success: true });
});

// Admin stats
router.get('/stats', (req, res) => {
  const stats = {
    totalStores: db.prepare('SELECT COUNT(*) as count FROM stores').get().count,
    totalAppointments: db.prepare('SELECT COUNT(*) as count FROM appointments').get().count,
    totalCalls: db.prepare('SELECT COUNT(*) as count FROM calls').get().count,
    totalCustomers: db.prepare('SELECT COUNT(*) as count FROM customers').get().count,
  };
  res.json(stats);
});

export default router;

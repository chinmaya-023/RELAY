import { Router } from 'express';
import { z } from 'zod';
import { requireRelayAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const userIdSchema = z.object({ uid: z.string().min(1).max(128) });
const accountStateSchema = z.object({ disabled: z.boolean() });

export const createAdminRouter = ({ adminService }) => {
  const router = Router();
  router.use(requireRelayAdmin);
  router.get('/access', (request, response) => response.json({ success: true, data: { isRelayAdmin: true, email: request.user.email } }));
  router.get('/overview', async (_request, response) => response.json({ success: true, data: await adminService.overview() }));
  router.patch('/users/:uid', async (request, response) => {
    const { uid } = userIdSchema.parse(request.params);
    const { disabled } = accountStateSchema.parse(request.body);
    if (uid === request.user.uid && disabled) throw new AppError(400, 'RELAY_ADMIN_SELF_SUSPEND_DENIED', 'Relay owners cannot suspend their own account.');
    return response.json({ success: true, data: await adminService.setUserDisabled(uid, disabled) });
  });
  return router;
};

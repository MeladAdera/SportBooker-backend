/**
 * Tenant entity as returned from DB.
 * Attached to req.tenant by TenantMiddleware.
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  cancel_cutoff_hours: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express Request augmentation requires namespace
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

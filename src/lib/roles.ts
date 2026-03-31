export const isOwner = (r?: string) => r === 'org_owner';
export const isAdmin = (r?: string) => r === 'org_admin';
export const isOwnerOrAdmin = (r?: string) => isOwner(r) || isAdmin(r);
export const canSeeAllDeals = (r?: string) => isOwnerOrAdmin(r) || r === 'org_manager';
export const canManageOrg = (r?: string) => isOwnerOrAdmin(r);

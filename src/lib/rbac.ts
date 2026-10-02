import { UserRole } from "@prisma/client"
import { SessionUser } from "@/types/auth"

export function hasRole(user: SessionUser | null, ...roles: UserRole[]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}

export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.ADMIN)
}

export function isSeller(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.SELLER_PRODUCT, UserRole.SELLER_SERVICE)
}

export function isProductSeller(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.SELLER_PRODUCT)
}

export function isServiceSeller(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.SELLER_SERVICE)
}

export function isCustomer(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.CUSTOMER)
}

export function isHotelSeller(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.SELLER_HOTEL)
}

export function isRestaurantSeller(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.SELLER_RESTAURANT)
}

export function isRider(user: SessionUser | null): boolean {
  return hasRole(user, UserRole.RIDER)
}

/**
 * Super Admin check: Platform owner with full, unrestricted access.
 * Backoffice Staff users have isBackofficeUser === true.
 */
export function isSuperAdmin(user: SessionUser | null): boolean {
  if (!user) return false
  return hasRole(user, UserRole.ADMIN) && !user.isBackofficeUser
}

/**
 * Backoffice Staff check: Staff member provisioned with assigned role permissions.
 */
export function isBackofficeStaff(user: SessionUser | null): boolean {
  if (!user) return false
  return user.isBackofficeUser === true
}

/**
 * General check for anyone permitted to enter the admin/backoffice environment.
 */
export function hasBackofficeAccess(user: SessionUser | null): boolean {
  if (!user) return false
  return hasRole(user, UserRole.ADMIN) || user.isBackofficeUser === true
}

/**
 * Granular permission check: Verifies if a user has access to a specific module.
 * Super Admins automatically bypass and are granted access to all modules.
 */
export function canAccessModule(user: SessionUser | null, moduleKey: string): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (!user.isBackofficeUser) return false
  return Array.isArray(user.permissions) && user.permissions.includes(moduleKey)
}


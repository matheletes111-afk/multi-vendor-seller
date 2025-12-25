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


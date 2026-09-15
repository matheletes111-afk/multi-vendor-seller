import { UserRole } from "@prisma/client"

export type UserRoleType = UserRole

export interface SessionUser {
  id: string
  email?: string | null
  phone?: string | null
  name?: string | null
  role: UserRole
  image?: string | null
}


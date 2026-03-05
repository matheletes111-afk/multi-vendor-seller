import { UserRole } from "@prisma/client"
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: UserRole
      image?: string | null
      /** Set for seller roles; must be true to access seller panels */
      isApproved?: boolean
      isSuspended?: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role: UserRole
    image?: string | null
    isApproved?: boolean
    isSuspended?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    isApproved?: boolean
    isSuspended?: boolean
  }
}


import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  basePath: "/api/nextauth",
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/customer/login",
    signOut: "/",
    error: "/customer/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        const requestedRole = credentials.role as string | undefined
        if (requestedRole && user.role !== requestedRole) {
          return null
        }

        // Sellers must be approved and not suspended to log in
        if (
          user.role === UserRole.SELLER_PRODUCT ||
          user.role === UserRole.SELLER_SERVICE
        ) {
          const seller = await prisma.seller.findUnique({
            where: { userId: user.id },
            select: { isApproved: true, isSuspended: true },
          })
          if (
            !seller ||
            !seller.isApproved ||
            (seller.isSuspended ?? false)
          ) {
            return null
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image,
            isApproved: true,
            isSuspended: false,
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        if ((user as any).isApproved !== undefined)
          token.isApproved = (user as any).isApproved
        if ((user as any).isSuspended !== undefined)
          token.isSuspended = (user as any).isSuspended
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        if (token.isApproved !== undefined)
          session.user.isApproved = token.isApproved as boolean
        if (token.isSuspended !== undefined)
          session.user.isSuspended = token.isSuspended as boolean
      }
      return session
    },
  },
})


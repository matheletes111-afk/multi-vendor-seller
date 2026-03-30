import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const PREFIX = "meeem"
const DIGITS = 8

type TxWithCounter = Prisma.TransactionClient & {
  orderCounter: {
    findUnique(args: { where: { id: number } }): Promise<{ lastValue: number } | null>
    upsert(args: {
      where: { id: number }
      create: { id: number; lastValue: number }
      update: { lastValue: number }
    }): Promise<unknown>
  }
}

/** Use inside `prisma.$transaction` so the counter and `Order` row commit together. */
export async function allocateNextOrderNumberTx(tx: Prisma.TransactionClient): Promise<string> {
  const t = tx as TxWithCounter
  await t.$executeRaw`SELECT pg_advisory_xact_lock(87234101)`
  const row = await t.orderCounter.findUnique({ where: { id: 1 } })
  const next = (row?.lastValue ?? 0) + 1
  await t.orderCounter.upsert({
    where: { id: 1 },
    create: { id: 1, lastValue: next },
    update: { lastValue: next },
  })
  return `${PREFIX}${String(next).padStart(DIGITS, "0")}`
}

/** Public display order numbers: `meeem00000001`, `meeem00000002`, … (internal `Order.id` remains cuid). */
export async function allocateNextOrderNumber(): Promise<string> {
  return prisma.$transaction(async (tx) => allocateNextOrderNumberTx(tx))
}

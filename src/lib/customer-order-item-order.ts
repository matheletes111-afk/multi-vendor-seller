/**
 * Order detail UI (customer / seller / admin): root lines first; each exchange replacement
 * immediately after its source — original → tracking → return → replacement → tracking.
 */
export type OrderItemLike = {
  id: string
  exchangeSourceOrderItemId?: string | null
  replacementOrderItemId?: string | null
}

export function flattenOrderItemsForDisplay<T extends OrderItemLike>(items: T[]): T[] {
  const roots = items.filter((i) => !i.exchangeSourceOrderItemId)
  const out: T[] = []
  const included = new Set<string>()

  for (const root of roots) {
    out.push(root)
    included.add(root.id)
    if (root.replacementOrderItemId) {
      const repl = items.find((l) => l.id === root.replacementOrderItemId)
      if (repl) {
        out.push(repl)
        included.add(repl.id)
      }
    }
  }

  for (const i of items) {
    if (i.exchangeSourceOrderItemId && !included.has(i.id)) {
      out.push(i)
      included.add(i.id)
    }
  }

  return out
}

/** @deprecated Use `flattenOrderItemsForDisplay` */
export const flattenOrderItemsForCustomerDisplay = flattenOrderItemsForDisplay

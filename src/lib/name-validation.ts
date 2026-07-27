import { prisma } from "@/lib/prisma"

/**
 * Normalizes text to detect obfuscated slangs or variations
 * e.g. "b@dw0rd" -> "badword"
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/\$/g, "s")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/!/g, "i")
    .replace(/[^a-z0-9\s]/g, "") // remove punctuation
    .trim()
}

export async function checkDisallowedName(name: string | null | undefined): Promise<{ isAllowed: boolean; matchedWord?: string; error?: string }> {
  if (!name || typeof name !== "string") {
    return { isAllowed: true }
  }

  const trimmedName = name.trim()
  if (!trimmedName) return { isAllowed: true }

  try {
    const globalSetting = await (prisma as any).globalSetting.findFirst({
      select: { disallowedNames: true }
    })

    const rawDisallowed: unknown = globalSetting?.disallowedNames
    if (!rawDisallowed || !Array.isArray(rawDisallowed) || rawDisallowed.length === 0) {
      return { isAllowed: true }
    }

    const disallowedList = rawDisallowed
      .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
      .filter((item) => item.length > 0)

    if (disallowedList.length === 0) {
      return { isAllowed: true }
    }

    const lowerName = trimmedName.toLowerCase()
    const normalizedName = normalizeText(trimmedName)

    // Tokenize name into words
    const wordsInName = lowerName.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/gi, ""))
    const normalizedWordsInName = normalizedName.split(/\s+/)

    for (const disallowedWord of disallowedList) {
      const normalizedDisallowed = normalizeText(disallowedWord)

      // 1. Direct substring match in lowercased name or normalized name (for multi-character terms)
      if (
        (disallowedWord.length >= 3 && lowerName.includes(disallowedWord)) ||
        (normalizedDisallowed.length >= 3 && normalizedName.includes(normalizedDisallowed))
      ) {
        return {
          isAllowed: false,
          matchedWord: disallowedWord,
          error: `The name "${trimmedName}" contains a restricted term ("${disallowedWord}"). Please choose a different name.`
        }
      }

      // 2. Exact word match (for shorter terms or single words)
      if (
        wordsInName.includes(disallowedWord) ||
        normalizedWordsInName.includes(normalizedDisallowed)
      ) {
        return {
          isAllowed: false,
          matchedWord: disallowedWord,
          error: `The name "${trimmedName}" contains a restricted term ("${disallowedWord}"). Please choose a different name.`
        }
      }
    }

    return { isAllowed: true }
  } catch (err) {
    console.error("Error in checkDisallowedName:", err)
    // Fallback to allow if DB query fails to avoid blocking system completely
    return { isAllowed: true }
  }
}

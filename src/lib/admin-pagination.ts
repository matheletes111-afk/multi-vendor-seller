export const ADMIN_PAGE_SIZE = 10

export type PaginationParams = {
  page?: string
  perPage?: string
}

export function getPaginationFromSearchParams(params: PaginationParams) {
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(params.perPage ?? String(ADMIN_PAGE_SIZE), 10) || ADMIN_PAGE_SIZE))
  const skip = (page - 1) * perPage
  return { page, perPage, skip, take: perPage }
}

export function buildAdminPageUrl(
  basePath: string,
  page: number,
  existingParams?: any
) {
  const search = new URLSearchParams()
  
  if (existingParams) {
    if (typeof existingParams.forEach === 'function') {
      // Handles URLSearchParams or ReadonlyURLSearchParams
      existingParams.forEach((value: string, key: string) => {
        search.set(key, value)
      })
    } else {
      // Handles plain objects
      Object.entries(existingParams).forEach(([key, value]) => {
        if (value) search.set(key, String(value))
      })
    }
  }

  search.set("page", String(page))
  
  const queryString = search.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

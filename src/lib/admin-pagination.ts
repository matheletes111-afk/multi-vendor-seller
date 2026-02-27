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
  existingParams?: { error?: string; success?: string }
) {
  const search = new URLSearchParams()
  search.set("page", String(page))
  if (existingParams?.error) search.set("error", existingParams.error)
  if (existingParams?.success) search.set("success", existingParams.success)
  return `${basePath}?${search.toString()}`
}

import { z } from "zod"

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
  commissionRate: z.number().min(0).max(100).default(10.0),
  isActive: z.boolean().default(true),
})

export const updateCategorySchema = createCategorySchema.partial().extend({
  name: z.string().min(1, "Name is required"),
})


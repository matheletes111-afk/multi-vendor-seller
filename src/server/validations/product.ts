import { z } from "zod"

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.number().positive("Price must be positive"),
  discount: z.number().min(0).optional(),
  hasGst: z.boolean().optional(),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  sku: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
})

export const updateProductSchema = createProductSchema.partial()

export const createVariantSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  sku: z.string().optional(),
  attributes: z.record(z.string()).optional(),
})


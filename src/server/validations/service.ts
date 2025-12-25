import { z } from "zod"

export const createServiceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  serviceType: z.enum(["APPOINTMENT", "FIXED_PRICE"]),
  basePrice: z.number().positive().optional(),
  duration: z.number().int().positive().optional(),
  images: z.array(z.string().url()).optional(),
})

export const updateServiceSchema = createServiceSchema.partial()

export const createServiceSlotSchema = z.object({
  serviceId: z.string().min(1),
  startTime: z.date(),
  endTime: z.date(),
})

export const createServicePackageSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  features: z.array(z.string()).optional(),
})


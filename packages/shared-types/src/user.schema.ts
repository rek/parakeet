import { z } from 'zod'

export const UserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    display_name: z.string().nullable(),
    biological_sex: z.enum(['female', 'male']).optional(),
    date_of_birth: z.string().nullable().optional(),
    created_at: z.string().datetime(),
  })
  .strict()

export type User = z.infer<typeof UserSchema>

export const UpdateUserSchema = z
  .object({
    display_name: z.string().optional(),
    biological_sex: z.enum(['female', 'male']).optional(),
    date_of_birth: z.string().nullable().optional(),
  })
  .strict()

export type UpdateUser = z.infer<typeof UpdateUserSchema>

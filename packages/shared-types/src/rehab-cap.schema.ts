import { z } from 'zod';

import { LiftSchema } from './program.schema';

export const RehabCapSchema = z
  .object({
    id: z.uuid(),
    user_id: z.uuid(),
    lift: LiftSchema,
    cap_kg: z.number().positive(),
    note: z.string().nullable(),
    planned_end_date: z.iso.date().nullable(),
    started_at: z.iso.datetime({ offset: true }),
    ended_at: z.iso.datetime({ offset: true }).nullable(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export type RehabCap = z.infer<typeof RehabCapSchema>;

export const CreateRehabCapInputSchema = z
  .object({
    lift: LiftSchema,
    cap_kg: z.number().positive(),
    note: z.string().optional(),
    planned_end_date: z.iso.date().optional(),
  })
  .strict();

export type CreateRehabCapInput = z.infer<typeof CreateRehabCapInputSchema>;

export const UpdateRehabCapInputSchema = z
  .object({
    cap_kg: z.number().positive().optional(),
    note: z.string().nullable().optional(),
    planned_end_date: z.iso.date().nullable().optional(),
    ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export type UpdateRehabCapInput = z.infer<typeof UpdateRehabCapInputSchema>;

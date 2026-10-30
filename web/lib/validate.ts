import { z } from 'zod';

/**
 * Central input validation for all future route handlers / server actions.
 * Rule: never trust client input — parse it through zod first, then use
 * the parsed (typed) result. Handlers should return 400 with the flattened
 * issues on failure.
 */

export const leadSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(200),
  contact_name: z.string().trim().min(1, 'Contact name is required').max(200),
  email: z.string().trim().email('Valid email is required').max(320),
  campaign_id: z.string().uuid('campaign_id must be a UUID'),
  source: z.string().trim().max(100).optional(),
  research_notes: z.string().max(5000).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** Form-level schema for the Add Lead modal: campaign is optional there. */
export const leadFormSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(200),
  contact_name: z.string().trim().min(1, 'Contact name is required').max(200),
  email: z.string().trim().email('Valid email is required').max(320),
  campaign_id: z.string().uuid().optional().or(z.literal('')),
  source: z.string().trim().max(100).optional().or(z.literal('')),
  research_notes: z.string().max(5000).optional().or(z.literal('')),
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;

export const noteSchema = z.object({
  note: z.string().trim().min(1, 'Note cannot be empty').max(5000),
});

export type NoteInput = z.infer<typeof noteSchema>;

export const leadPatchSchema = z
  .object({
    stage: z.string().trim().min(1).max(40).optional(),
    grade: z.enum(['A', 'B', 'C']).optional(),
  })
  .refine((v) => v.stage !== undefined || v.grade !== undefined, {
    message: 'Nothing to update: provide stage and/or grade',
  });

export type LeadPatchInput = z.infer<typeof leadPatchSchema>;

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/** Parse unknown input; throws a single Error with human-readable issues. */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Validation failed: ${issues}`);
  }
  return result.data;
}

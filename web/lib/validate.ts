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

/* ---------- Phase 1C: sequences ---------- */

export const sequenceStepSchema = z.object({
  campaign_id: z.string().uuid('campaign_id must be a UUID'),
  step_day: z.number().int().min(0, 'Day must be 0 or more').max(60, 'Day must be 60 or less'),
  subject: z.string().trim().max(200, 'Subject is too long').optional().or(z.literal('')),
  body: z.string().trim().min(1, 'Email body is required').max(20000, 'Body is too long'),
});

export type SequenceStepInput = z.infer<typeof sequenceStepSchema>;

/** Full replacement on edit (client always sends the complete step). */
export const sequenceStepPutSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
  step_day: z.number().int().min(0).max(60),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  body: z.string().trim().min(1, 'Email body is required').max(20000),
});

export type SequenceStepPutInput = z.infer<typeof sequenceStepPutSchema>;

/* ---------- Phase 1C: send queue ---------- */

/** Replies composer → queue insert. status is ALWAYS 'queued' (the only
 *  waiting state the migration's CHECK constraint allows — no 'draft'). */
export const queueInsertSchema = z.object({
  lead_id: z.string().uuid('lead_id must be a UUID'),
  account_id: z.string().uuid('account_id must be a UUID').nullable().optional(),
  subject: z.string().trim().max(200, 'Subject is too long').optional().or(z.literal('')),
  body: z.string().trim().min(1, 'Reply body is required').max(20000, 'Body is too long'),
});

export type QueueInsertInput = z.infer<typeof queueInsertSchema>;

export const queueActionSchema = z.object({
  action: z.enum(['pause', 'retry'], { message: "action must be 'pause' or 'retry'" }),
});

export type QueueActionInput = z.infer<typeof queueActionSchema>;

/* ---------- Phase 1C: campaigns ---------- */

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required').max(200),
  niche: z.string().trim().min(1, 'Niche is required').max(60),
  /** niche key of the campaign_templates preset to start from (optional) */
  preset_niche: z.string().trim().max(60).optional().or(z.literal('')),
  /** existing campaign id to clone (optional; wins over preset when both given) */
  clone_from: z.string().uuid('clone_from must be a UUID').optional().or(z.literal('')),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignPatchSchema = z.object({
  is_active: z.boolean(),
});

export type CampaignPatchInput = z.infer<typeof campaignPatchSchema>;

/* ---------- Phase 1C: worker proxy ---------- */

/** Exact upstream paths the dashboard may call. Nothing else is forwarded. */
export const workerPathSchema = z.enum([
  'workers/send/run',
  'workers/poll/run',
  'workers/health/run',
  'queue',
  'alerts',
]);

export type WorkerPath = z.infer<typeof workerPathSchema>;

export const WORKER_METHODS: Record<WorkerPath, 'GET' | 'POST'> = {
  'workers/send/run': 'POST',
  'workers/poll/run': 'POST',
  'workers/health/run': 'POST',
  queue: 'GET',
  alerts: 'GET',
};

/* ---------- Phase 1D: proposals / calls / settings / kill-switch ---------- */

export const proposalSchema = z.object({
  lead_id: z.string().uuid('lead_id must be a UUID'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative').max(100_000_000),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type ProposalInput = z.infer<typeof proposalSchema>;

/** Target statuses only — forward-only is enforced server-side against the
 *  current row, so the client can never skip draft → accepted. */
export const proposalStatusSchema = z.object({
  status: z.enum(['sent', 'accepted', 'rejected']),
});

export type ProposalStatusInput = z.infer<typeof proposalStatusSchema>;

export const callSchema = z.object({
  lead_id: z.string().uuid('lead_id must be a UUID'),
  scheduled_at: z.string().trim().min(1, 'Date and time are required').max(40),
  outcome: z.enum(['scheduled', 'done', 'no_show', 'cancelled']),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type CallInput = z.infer<typeof callSchema>;

export const settingsSchema = z
  .object({
    agency_name: z.string().trim().max(200).optional(),
    founder_name: z.string().trim().max(200).optional(),
    postal_address: z.string().trim().max(500).optional(),
    cal_link: z.string().trim().max(500).optional(),
    linkedin_headline: z.string().trim().max(300).optional(),
    alert_email: z.string().trim().max(320).optional(),
    send_window_tz: z.string().trim().max(100).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Nothing to update',
  });

export type SettingsInput = z.infer<typeof settingsSchema>;

export const killSwitchSchema = z
  .object({
    action: z.enum(['pause', 'resume']),
    confirm: z.string().optional(),
  })
  .refine((v) => v.action !== 'pause' || v.confirm === 'PAUSE', {
    message: 'Pausing requires typing PAUSE to confirm',
  });

export type KillSwitchInput = z.infer<typeof killSwitchSchema>;

export const campaignSwitchSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

export type CampaignSwitchInput = z.infer<typeof campaignSwitchSchema>;

import { z } from 'zod';

export const pageSchema = z.object({
  id: z.string().min(1),
  urls: z.object({
    template: z.string().url(),
    ote: z.string().url(),
    production: z.string().url(),
  }),
  roles: z
    .object({
      template: z.literal('reference'),
      ote: z.literal('target'),
      production: z.literal('target'),
    })
    .default({ template: 'reference', ote: 'target', production: 'target' }),
  pageType: z.string().min(1).optional(),
  severity: z.enum(['critical', 'high', 'medium']),
  status: z.enum(['confirmed', 'pending_classification', 'disabled']),
  selectors: z
    .record(
      z.enum(['template', 'ote', 'production']),
      z.record(
        z.object({
          selector: z.string().min(1),
          status: z.enum(['confirmed', 'pending']),
          cssProperties: z.array(z.string().min(1)).optional(),
        }),
      ),
    )
    .optional(),
  internalLinkPolicy: z
    .object({
      unsafePathPatterns: z.array(z.string().min(1)),
      maxLinks: z.number().int().positive(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});
export const ruleSchema = z.object({
  id: z.string().min(1),
  tier: z.enum(['global', 'page_type', 'exception']),
  target: z.string().min(1),
  definition: z.record(z.unknown()),
  severity: z.enum(['critical', 'high', 'medium']),
  enabled: z.boolean(),
  version: z.number().int().positive(),
});

export type PageConfig = z.infer<typeof pageSchema>;
export type RuleConfig = z.infer<typeof ruleSchema>;

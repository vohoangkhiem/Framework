import { z } from 'zod';

/**
 * Runtime contracts for API responses. Validating payloads with Zod turns silent schema
 * drift (renamed field, string instead of number) into an explicit, early failure.
 */
export const apiProductSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  cat: z.string(),
  desc: z.string().optional(),
  img: z.string().optional(),
});

export const entriesResponseSchema = z.object({
  Items: z.array(apiProductSchema),
  // The API serialises the pagination key id as a string although item ids are numbers, and it
  // still returns a key on the last page; callers stop on ScannedCount instead.
  LastEvaluatedKey: z
    .object({ id: z.union([z.string(), z.number()]).transform(String) })
    .optional(),
  Count: z.number().optional(),
  ScannedCount: z.number().optional(),
});

export const errorResponseSchema = z.object({
  errorMessage: z.string(),
});

export const checkTokenSuccessSchema = z.object({
  Item: z.object({ username: z.string() }),
});

export const cartItemSchema = z.object({
  id: z.string(),
  cookie: z.string(),
  prod_id: z.coerce.number(),
  flag: z.boolean().optional(),
});

export const viewCartResponseSchema = z.object({
  Items: z.array(cartItemSchema),
});

export type ApiProductDto = z.infer<typeof apiProductSchema>;
export type EntriesResponseDto = z.infer<typeof entriesResponseSchema>;
export type ErrorResponseDto = z.infer<typeof errorResponseSchema>;
export type ViewCartResponseDto = z.infer<typeof viewCartResponseSchema>;

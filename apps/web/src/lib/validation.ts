import { z } from 'zod';

/** Mirrors the API's limits for instant feedback. The API remains the authority. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email wajib diisi')
  .max(254)
  .pipe(z.email('Masukkan alamat email yang valid'));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Gunakan minimal ${PASSWORD_MIN} karakter`)
  .max(PASSWORD_MAX, `Gunakan maksimal ${PASSWORD_MAX} karakter`);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Kata sandi wajib diisi').max(PASSWORD_MAX),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100),
  email: emailSchema,
  password: newPasswordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: 'Kata sandi tidak cocok',
    path: ['confirm'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
    newPassword: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'Kata sandi tidak cocok',
    path: ['confirm'],
  });

export const slugSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/,
    'Gunakan huruf kecil, angka, dan tanda hubung (tidak di awal atau akhir)',
  );

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Gunakan minimal 2 karakter').max(80),
  slug: z.union([slugSchema, z.literal('')]).optional(),
});

export const inviteSchema = z.object({
  email: emailSchema,
  roleId: z.uuid('Pilih peran'),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

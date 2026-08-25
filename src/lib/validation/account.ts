import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Podaj poprawny adres e-mail"),
  username: z
    .string()
    .min(3, "Nazwa użytkownika musi mieć min. 3 znaki")
    .max(20, "Nazwa użytkownika może mieć max. 20 znaków")
    .regex(/^[a-zA-Z0-9_]+$/, "Dozwolone tylko litery, cyfry i podkreślenia"),
  password: z.string().min(8, "Hasło musi mieć min. 8 znaków"),
  name: z.string().optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Podaj e-mail lub nazwę użytkownika"),
  password: z.string().min(1, "Podaj hasło")
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Hasło musi mieć min. 8 znaków")
});

export const commentSchema = z.object({
  body: z.string().min(2, "Komentarz jest za krótki").max(2000, "Komentarz jest za długi")
});

export const bankHistorySchema = z.object({
  bankId: z.string().min(1),
  wasClientUntil: z.string().optional().nullable()
});

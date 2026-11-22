export interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export const SIGN_IN_PENDING = "Sign-in is not connected yet. No account was checked.";
export const REGISTER_PENDING = "Registration is not connected yet. No account was created.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function validateSignIn(input: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL.test(input.email.trim())) errors.email = "Enter a valid email address.";
  if (input.password.length < 8) errors.password = "Password must be at least 8 characters.";
  return errors;
}

export function validateRegister(input: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.name.trim().length < 2) errors.name = "Enter the name you use at the library.";
  if (!EMAIL.test(input.email.trim())) errors.email = "Enter a valid email address.";
  if (input.password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (input.confirm !== input.password) errors.confirm = "Passwords do not match.";
  return errors;
}

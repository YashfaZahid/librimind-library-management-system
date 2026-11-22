export interface AccountProfile {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "admin";
  programme: string;
  readingInterests: string[];
}

export function parseInterests(value: string): string[] {
  const interests: string[] = [];
  for (const part of value.split(",")) {
    const interest = part.trim();
    if (interest && !interests.includes(interest)) interests.push(interest);
  }
  return interests.slice(0, 12);
}

export function profileWrite(input: { fullName: string; programme: string; interests: string }) {
  return {
    full_name: input.fullName.trim(),
    programme: input.programme.trim() || null,
    reading_interests: parseInterests(input.interests),
  };
}

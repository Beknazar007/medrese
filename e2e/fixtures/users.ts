// Stand accounts created by e2e/fixtures/seed.py — made-up people only.
export const PASSWORD = "password";

export const USERS = {
  rector: { username: "rector", home: "/dashboard" },
  dean: { username: "dean", home: "/dashboard" },
  teacher: { username: "teacher", home: "/schedule", fullName: "Мамытов Азамат" },
  hafiz: { username: "hafiz", home: "/schedule", fullName: "Абдыкадыров Ислам" },
} as const;

export type Role = keyof typeof USERS;

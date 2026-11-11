// Stand accounts created by e2e/fixtures/seed.py — made-up people only.
export const PASSWORD = "password";

export const USERS = {
  rector: { username: "rector", home: "/dashboard" },
  dean: { username: "dean", home: "/dashboard" },
  teacher: { username: "teacher", home: "/schedule", fullName: "Мамытов Азамат" },
  hafiz: { username: "hafiz", home: "/schedule", fullName: "Абдыкадыров Ислам" },
} as const;

export type Role = keyof typeof USERS;

// Extra accounts seeded only for the e2e run (E2E_EXTRA_DATA=1 in seed.py), not for videos.
export const EXTRA_USERS = {
  // Seeded always (not only for e2e); listed here so tests can log in as a second teacher.
  teacher2: { username: "teacher2", home: "/schedule", fullName: "Садыков Эрлан" },
  teacher3: { username: "teacher3", home: "/schedule", fullName: "Жээнбеков Канат" },
  teacher4: { username: "teacher4", home: "/schedule", fullName: "Токтоматов Нурлан" },
  teacher5: { username: "teacher5", home: "/schedule", fullName: "Эсенов Бакыт" },
  pwd_teacher_mobile: { username: "pwd_teacher_mobile", home: "/schedule" },
  pwd_teacher_desktop: { username: "pwd_teacher_desktop", home: "/schedule" },
  pwd_rector: { username: "pwd_rector", home: "/dashboard" },
  // ux-fixes-2, criterion 43: exactly 60 characters.
  long_name_teacher: {
    username: "long_name_teacher",
    home: "/schedule",
    fullName: "Абдыкадыров-Сатыбалдиев Мухаммедали Абдыжапарович уулу Бекту",
  },
} as const;

export type ExtraUser = keyof typeof EXTRA_USERS;

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, teachersApi } from "../../api/entities";
import Button from "../../components/ui/Button";
import { Field, SelectInput, TextInput } from "../../components/ui/Field";
import { InfoBanner } from "../../components/ui/Banner";
import { useAuth } from "../../context/AuthContext";
import { generatePassword, generateUsername } from "../../lib/credentials";
import { apiErrorMessage } from "../../lib/errors";
import { termHoursForTeacher } from "../../lib/hours";
import { useDepartments, useSubjects, useTeachers } from "../../hooks/useReferenceData";

const DEGREE_KEYS = ["ASSISTANT", "SENIOR_LECTURER", "DOCENT", "PROFESSOR"] as const;

export default function DeanTeachersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: departments } = useDepartments();
  const { data: allTeachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: assignments } = useQuery({ queryKey: ["assignments"], queryFn: () => assignmentsApi.list() });

  const departmentId = user?.headed_department_id ?? null;
  const department = departments?.find((d) => d.id === departmentId);
  const teachers = (allTeachers ?? []).filter((tch) => tch.department_id === departmentId);

  const [fullName, setFullName] = useState("");
  const [degree, setDegree] = useState<(typeof DEGREE_KEYS)[number]>("ASSISTANT");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issuedCredentials, setIssuedCredentials] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => teachersApi.create(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      setIssuedCredentials({ username: variables.username as string, password: variables.password as string });
      setFullName("");
      setPhone("");
    },
    onError: (err) => setError(apiErrorMessage(err, "Error")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIssuedCredentials(null);

    if (fullName.trim().length < 3) {
      setError(t("dean.err_name_short"));
      return;
    }
    if (teachers.some((tch) => tch.full_name.trim().toLowerCase() === fullName.trim().toLowerCase())) {
      setError(t("dean.err_name_duplicate"));
      return;
    }
    if (departmentId === null) return;

    const username = generateUsername(fullName);
    const password = generatePassword();
    createMutation.mutate({
      username,
      password,
      full_name: fullName.trim(),
      department_id: departmentId,
      academic_degree: degree,
      phone: phone.trim() || null,
    });
  }

  const departmentHours = teachers.reduce(
    (sum, tch) => sum + termHoursForTeacher(assignments ?? [], subjects ?? [], tch.id),
    0,
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 48 }}>
      <div>
        <div className="kicker">
          {t("dean.kicker")} · {department?.name}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 600, margin: "6px 0 4px" }}>{t("dean.teachers_title")}</h1>
        <p style={{ fontSize: 13.5, color: "var(--color-neutral-700)", marginBottom: 24 }}>
          {teachers.length} {t("dean.teacher_count")} · {departmentHours} {t("dean.department_hours")}
        </p>

        {teachers.map((tch) => (
          <div key={tch.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-hairline)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{tch.full_name}</span>
              <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>
                {termHoursForTeacher(assignments ?? [], subjects ?? [], tch.id)}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--color-neutral-700)" }}>
              {tch.academic_degree ? t(`degrees.${tch.academic_degree}`) : ""} {tch.phone ? `· ${tch.phone}` : ""}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={t("dean.full_name")}>
          <TextInput value={fullName} onChange={(e) => { setFullName(e.target.value); setError(null); }} required />
        </Field>
        <Field label={t("dean.degree")}>
          <SelectInput value={degree} onChange={(e) => setDegree(e.target.value as typeof degree)}>
            {DEGREE_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`degrees.${key}`)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={t("dean.phone")}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <p style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--color-neutral-500)" }}>
          {t("dean.department_note")}
        </p>
        {error && <p className="field-error">{error}</p>}
        <Button type="submit" variant="primary" disabled={createMutation.isPending}>
          {t("dean.add")}
        </Button>

        {issuedCredentials && (
          <InfoBanner>
            {t("login.username")}: <strong>{issuedCredentials.username}</strong>
            <br />
            {t("login.password")}: <strong>{issuedCredentials.password}</strong>
          </InfoBanner>
        )}
      </form>
    </div>
  );
}

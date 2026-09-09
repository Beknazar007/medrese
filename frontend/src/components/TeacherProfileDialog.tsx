import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Teacher } from "../api/types";
import { nameById, useDepartments } from "../hooks/useReferenceData";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function TeacherProfileDialog({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: departments } = useDepartments();

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{teacher.full_name}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Avatar src={teacher.photo ?? undefined} sx={{ width: 88, height: 88, fontSize: 32 }}>
            {teacher.full_name.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {nameById(departments, teacher.department_id, (d) => d.name)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("teachers.username_label")}: {teacher.username}
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ minWidth: 160 }}>
            <Field label={t("teachers.degree")} value={teacher.academic_degree} />
          </Box>
          <Box sx={{ minWidth: 160 }}>
            <Field label={t("teachers.phone")} value={teacher.phone} />
          </Box>
          <Box sx={{ minWidth: 160 }}>
            <Field label={t("teachers.hired")} value={teacher.hire_date} />
          </Box>
          <Box sx={{ minWidth: 160 }}>
            <Field label={t("teachers.experience_years")} value={teacher.teaching_experience_years} />
          </Box>
        </Box>

        <Field label={t("teachers.education")} value={teacher.education} />
        <Field label={t("teachers.competency")} value={teacher.competency} />
        <Field label={t("teachers.previous_subjects")} value={teacher.previous_subjects} />
        <Field label={t("teachers.can_teach")} value={teacher.can_teach} />
        <Field label={t("teachers.bio")} value={teacher.bio} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

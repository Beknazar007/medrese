import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import RepeatIcon from "@mui/icons-material/Repeat";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hifzApi } from "../../api/entities";
import type { HifzKind, HifzRecord, HifzTarget } from "../../api/types";
import { useConfirm } from "../../context/ConfirmContext";
import { KIND_KEYS, activeTarget, dayOfWeek, fmtDate, rangeText } from "./hifzUtils";

interface KindForm {
  score: string;
  juz: string;
  page_from: string;
  page_to: string;
  comment: string;
  // Juz pre-filled from the student's target. On its own it's no reason to create a record.
  autoJuz: string | null;
}

const str = (v: number | null | undefined) => (v == null ? "" : String(v));
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function HifzDayDialog({
  student,
  date,
  records,
  targets,
  readOnly,
  onClose,
  onSaved,
  onError,
}: {
  student: { id: number; name: string; group: string };
  date: string;
  records: Record<HifzKind, HifzRecord | null>;
  targets: HifzTarget[];
  readOnly: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (err: unknown) => void;
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const units = { juz: t("hifz.unit_juz"), page: t("hifz.unit_page") };
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Record<HifzKind, KindForm>>(() => {
    const init = (k: HifzKind): KindForm => {
      const r = records[k];
      const target = activeTarget(targets, student.id, k, date);
      // Read-only viewers see only what was actually recorded, never a pre-filled juz.
      const autoJuz = !readOnly && !r && target?.juz_from != null ? String(target.juz_from) : null;
      return {
        score: str(r?.score),
        juz: r ? str(r.juz) : (autoJuz ?? ""),
        page_from: str(r?.page_from),
        page_to: str(r?.page_to),
        comment: r?.comment ?? "",
        autoJuz,
      };
    };
    return { HIFZ: init("HIFZ"), REPEAT: init("REPEAT") };
  });

  const hasAnyRecord = Boolean(records.HIFZ || records.REPEAT);

  // Autosave: each kind (hifz / repeat) is saved on its own 0.7 s after typing stops and at once
  // on blur; closing the window waits for everything to land. Saves of a kind run in order.
  const formRef = useRef(form);
  formRef.current = form;
  // An undefined timer marks an emptied kind waiting for blur/close — never deleted mid-correction.
  const timers = useRef(new Map<HifzKind, ReturnType<typeof setTimeout> | undefined>());
  const chains = useRef(new Map<HifzKind, Promise<void>>());
  const savedSomething = useRef(false);
  const [inFlight, setInFlight] = useState(0);
  const [failed, setFailed] = useState(false);

  function saveKind(k: HifzKind) {
    const f = formRef.current[k];
    if (scoreInvalid(f.score)) return;
    const base = { student_id: student.id, date, kind: k };
    // Sending an empty cell deletes that kind's record on the server.
    const payload = isFilled(f)
      ? {
          ...base,
          score: numOrNull(f.score),
          juz: numOrNull(f.juz),
          page_from: numOrNull(f.page_from),
          page_to: numOrNull(f.page_to),
          comment: f.comment.trim() || null,
        }
      : base;
    const next = (chains.current.get(k) ?? Promise.resolve()).then(async () => {
      setInFlight((n) => n + 1);
      try {
        await hifzApi.putRecord(payload);
        savedSomething.current = true;
        setFailed(false);
      } catch (err) {
        setFailed(true);
        onError(err);
      } finally {
        setInFlight((n) => n - 1);
      }
    });
    chains.current.set(k, next);
  }

  function flush(k: HifzKind) {
    if (!timers.current.has(k)) return;
    clearTimeout(timers.current.get(k));
    timers.current.delete(k);
    saveKind(k);
  }

  function update(k: HifzKind, patch: Partial<KindForm>) {
    const next = { ...formRef.current, [k]: { ...formRef.current[k], ...patch } };
    formRef.current = next;
    setForm(next);
    if (readOnly) return;
    clearTimeout(timers.current.get(k));
    timers.current.set(
      k,
      setTimeout(() => {
        if (!isFilled(formRef.current[k])) {
          timers.current.set(k, undefined);
          return;
        }
        timers.current.delete(k);
        saveKind(k);
      }, 700),
    );
  }

  async function finishAndClose() {
    KIND_KEYS.forEach(flush);
    await Promise.all([...chains.current.values()]);
    if (savedSomething.current) onSaved(t("hifz.saved"));
    else onClose();
  }

  // A reload or a switch to another app sends whatever is still waiting.
  useEffect(() => {
    const onHide = () => KIND_KEYS.forEach(flush);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function isFilled(f: KindForm): boolean {
    const juzCounts = f.juz.trim() !== "" && f.juz !== f.autoJuz;
    return f.score.trim() !== "" || f.page_from.trim() !== "" || f.page_to.trim() !== "" || f.comment.trim() !== "" || juzCounts;
  }

  async function handleClear() {
    const ok = await confirm({ message: t("hifz.clear_day_confirm"), destructive: true, confirmLabel: t("hifz.clear_day") });
    if (!ok) return;
    for (const k of KIND_KEYS) clearTimeout(timers.current.get(k));
    timers.current.clear();
    setSaving(true);
    try {
      await Promise.all([...chains.current.values()]);
      for (const k of KIND_KEYS) await hifzApi.putRecord({ student_id: student.id, date, kind: k });
      onSaved(t("hifz.day_cleared"));
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  function scoreInvalid(v: string): boolean {
    return v.trim() !== "" && (Number(v) < 0 || Number(v) > 100 || !Number.isInteger(Number(v)));
  }

  return (
    <Dialog open onClose={finishAndClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 0.5 }}>
        {fmtDate(date)} · {t(`days.${dayOfWeek(date)}`)}
        <Typography variant="body2" color="text.secondary">
          <b>{student.name}</b>
          {student.group ? ` · ${student.group}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {KIND_KEYS.map((k, i) => {
          const f = form[k];
          const target = activeTarget(targets, student.id, k, date);
          return (
            <Box
              key={k}
              sx={{ border: 1, borderColor: "divider", borderRadius: 2.5, p: 1.75, mb: 1.5, mt: i === 0 ? 1 : 0, bgcolor: "action.hover" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                {k === "HIFZ" ? <MenuBookIcon fontSize="small" color="primary" /> : <RepeatIcon fontSize="small" color="warning" />}
                <Typography sx={{ fontWeight: 600 }}>{k === "HIFZ" ? t("hifz.kind_hifz") : t("hifz.kind_repeat")}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: { md: "auto" }, width: { xs: "100%", md: "auto" } }}>
                  {target ? `${t("hifz.target_label")}: ${rangeText(target, units)}` : t("hifz.target_not_given")}
                </Typography>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1.4fr" }, gap: 1.25, mb: 1.25 }}>
                <TextField
                  size="small"
                  type="number"
                  label={t("hifz.score_pct")}
                  value={f.score}
                  disabled={readOnly}
                  error={scoreInvalid(f.score)}
                  autoFocus={!isMobile && !readOnly && k === "HIFZ"}
                  onChange={(e) => update(k, { score: e.target.value })}
                  onBlur={() => flush(k)}
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                />
                <TextField
                  size="small"
                  type="number"
                  label={t("hifz.col_juz")}
                  value={f.juz}
                  disabled={readOnly}
                  onChange={(e) => update(k, { juz: e.target.value })}
                  onBlur={() => flush(k)}
                  slotProps={{ htmlInput: { min: 1, max: 30 } }}
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, gridColumn: { xs: "1 / -1", md: "auto" } }}>
                  <TextField
                    size="small"
                    type="number"
                    label={t("hifz.col_page_from")}
                    value={f.page_from}
                    disabled={readOnly}
                    onChange={(e) => update(k, { page_from: e.target.value })}
                  onBlur={() => flush(k)}
                    slotProps={{ htmlInput: { min: 1, max: 604 } }}
                  />
                  –
                  <TextField
                    size="small"
                    type="number"
                    label={t("hifz.col_page_to")}
                    value={f.page_to}
                    disabled={readOnly}
                    onChange={(e) => update(k, { page_to: e.target.value })}
                  onBlur={() => flush(k)}
                    slotProps={{ htmlInput: { min: 1, max: 604 } }}
                  />
                </Box>
              </Box>
              <TextField
                size="small"
                fullWidth
                label={t("hifz.col_comment")}
                value={f.comment}
                disabled={readOnly}
                onChange={(e) => update(k, { comment: e.target.value })}
                  onBlur={() => flush(k)}
              />
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!readOnly && hasAnyRecord && (
          <Button
            color="error"
            startIcon={isMobile ? undefined : <DeleteIcon />}
            disabled={saving}
            onClick={handleClear}
            sx={{ mr: "auto", whiteSpace: "nowrap" }}
          >
            {t("hifz.clear_day")}
          </Button>
        )}
        {!readOnly && (
          <Typography variant="caption" color={failed ? "error" : "text.secondary"} sx={{ mr: "auto", alignSelf: "center" }}>
            {failed ? t("hifz.autosave_failed") : inFlight > 0 ? t("hifz.autosave_saving") : t("hifz.autosave_hint")}
          </Typography>
        )}
        <Button variant={readOnly ? "text" : "contained"} disabled={saving} onClick={finishAndClose}>
          {readOnly ? t("common.close") : t("hifz.done")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

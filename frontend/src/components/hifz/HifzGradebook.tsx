import {
  Alert,
  Box,
  Chip,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hifzApi } from "../../api/entities";
import type { HifzKind, HifzRecord } from "../../api/types";
import { apiErrorMessage } from "../../lib/errors";
import StudentProfileDialog from "../StudentProfileDialog";
import HifzDayDialog from "./HifzDayDialog";
import HifzExamsDialog from "./HifzExamsDialog";
import {
  KIND_KEYS,
  LEVEL_CHIP,
  LEVEL_COLOR,
  dayOfWeek,
  daysBetween,
  eachDay,
  fmtDate,
  fmtShort,
  level,
  monthRange,
  rangeText,
  todayIso,
  weekRange,
} from "./hifzUtils";

export type PeriodPreset = "today" | "week" | "month" | "custom";

/** Lifted to the page so the assignments tab can open the journal on a target's period. */
export interface GradebookView {
  preset: PeriodPreset;
  from: string;
  to: string;
  groupId: number | "";
  focusStudentId: number | null;
}

interface Stats {
  avg: number | null;
  days: number;
  exam: number | null;
  examCount: number;
}

const NO_STATS: Stats = { avg: null, days: 0, exam: null, examCount: 0 };

export default function HifzGradebook({
  view,
  onViewChange,
}: {
  view: GradebookView;
  onViewChange: (next: GradebookView) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledForKey = useRef<string>("");
  const [cell, setCell] = useState<{ studentId: number; date: string } | null>(null);
  const [examsStudent, setExamsStudent] = useState<{ id: number; name: string } | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(view.preset === "custom");

  const { data: journal, error } = useQuery({
    queryKey: ["hifz-journal", view.from, view.to],
    queryFn: () => hifzApi.journal(view.from, view.to),
    // Keep the old table mounted while a new period loads so the horizontal scroll survives saves.
    placeholderData: keepPreviousData,
  });

  // Opaque tints (spec tokens): pinned columns must hide the day cells scrolling under them.
  const dark = theme.palette.mode === "dark";
  const headBg = dark ? "#1d2127" : "#f5f6f7";
  const tint = dark ? "#182545" : "#eff4fe";
  const tint2 = dark ? "#1e3159" : "#dde7fc";
  const accentInk = dark ? "#a9c3fb" : "#2249b8";

  const nameW = isMobile ? 124 : 188;
  const avgW = isMobile ? 62 : 84;
  const examW = isMobile ? 70 : 84;
  const today = todayIso();
  const units = { juz: t("hifz.unit_juz"), page: t("hifz.unit_page") };
  const shortOf = (k: HifzKind) => (k === "HIFZ" ? t("hifz.kind_hifz_short") : t("hifz.kind_repeat_short"));

  function setPeriod(preset: PeriodPreset, from?: string, to?: string) {
    let range = { from: from ?? view.from, to: to ?? view.to };
    if (preset === "today") range = { from: today, to: today };
    else if (preset === "week") range = weekRange();
    else if (preset === "month") range = monthRange();
    onViewChange({ ...view, preset, ...range, focusStudentId: null });
  }

  function setCustomDate(which: "from" | "to", value: string) {
    if (!value) return;
    let from = which === "from" ? value : view.from;
    let to = which === "to" ? value : view.to;
    if (to < from) [from, to] = [to, from];
    if (daysBetween(from, to) > 400) {
      setSnackbar(t("hifz.period_too_long"));
      return;
    }
    setPeriod("custom", from, to);
  }

  // Only data for the period actually selected counts — never a stale placeholder.
  const current = journal && journal.date_from === view.from && journal.date_to === view.to ? journal : undefined;
  const shown = current ?? journal;
  const days = useMemo(() => (shown ? eachDay(shown.date_from, shown.date_to) : []), [shown]);

  const students = useMemo(
    () => (shown?.students ?? []).filter((s) => view.groupId === "" || s.group_id === view.groupId),
    [shown, view.groupId],
  );
  const groupName = (id: number) => shown?.groups.find((g) => g.id === id)?.name ?? "";

  const recordIndex = useMemo(() => {
    const m = new Map<string, HifzRecord>();
    for (const r of shown?.records ?? []) m.set(`${r.student_id}|${r.date}|${r.kind}`, r);
    return m;
  }, [shown]);

  const stats = useMemo(() => {
    const acc = new Map<number, { sum: number; n: number; days: Set<string>; esum: number; en: number }>();
    const get = (id: number) => {
      if (!acc.has(id)) acc.set(id, { sum: 0, n: 0, days: new Set(), esum: 0, en: 0 });
      return acc.get(id)!;
    };
    for (const r of shown?.records ?? []) {
      if (r.score == null) continue;
      const v = get(r.student_id);
      v.sum += r.score;
      v.n += 1;
      v.days.add(r.date);
    }
    for (const e of shown?.exams ?? []) {
      if (e.score == null) continue;
      const v = get(e.student_id);
      v.esum += e.score;
      v.en += 1;
    }
    const out = new Map<number, Stats>();
    acc.forEach((v, id) =>
      out.set(id, {
        avg: v.n ? v.sum / v.n : null,
        days: v.days.size,
        exam: v.en ? v.esum / v.en : null,
        examCount: v.en,
      }),
    );
    return out;
  }, [shown]);

  // Day average across the *visible* (group-filtered) students only; exams never count.
  const dayAverages = useMemo(() => {
    const visible = new Set(students.map((s) => s.id));
    const acc = new Map<string, { sum: number; n: number }>();
    for (const r of shown?.records ?? []) {
      if (r.score == null || !visible.has(r.student_id)) continue;
      const v = acc.get(r.date) ?? { sum: 0, n: 0 };
      v.sum += r.score;
      v.n += 1;
      acc.set(r.date, v);
    }
    return acc;
  }, [shown, students]);

  // When the period changes, scroll so today's column (or the last day) sits right after the
  // pinned columns. Saves within the same period keep the teacher's scroll position.
  useLayoutEffect(() => {
    const key = `${view.from}|${view.to}`;
    const wrap = scrollRef.current;
    if (!current || !wrap || scrolledForKey.current === key) return;
    scrolledForKey.current = key;
    const th = wrap.querySelector<HTMLElement>("th[data-today='1']") ?? wrap.querySelector<HTMLElement>("th[data-day]:last-of-type");
    const pinned = wrap.querySelector<HTMLElement>("thead th[data-col='exam']");
    if (!th || !pinned) return;
    const delta = th.getBoundingClientRect().left - pinned.getBoundingClientRect().right;
    if (Math.abs(delta) > 4) wrap.scrollLeft += delta - 8;
  }, [current, view.from, view.to]);

  // Arriving from an assignment: centre and highlight that student's row, then let it fade.
  useEffect(() => {
    if (!current || view.focusStudentId == null) return;
    const row = scrollRef.current?.querySelector<HTMLElement>(`tr[data-student='${view.focusStudentId}']`);
    row?.scrollIntoView({ block: "center" });
    const timer = window.setTimeout(() => onViewChange({ ...view, focusStudentId: null }), 2500);
    return () => window.clearTimeout(timer);
  }, [current, view, onViewChange]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["hifz-journal"] });
    queryClient.invalidateQueries({ queryKey: ["hifz-targets-all"] });
  }

  const periodLabel =
    view.from === view.to
      ? `${fmtDate(view.from)}, ${t(`days.${dayOfWeek(view.from)}`)}`
      : `${fmtDate(view.from)} — ${fmtDate(view.to)} · ${t("hifz.days_count", { count: daysBetween(view.from, view.to) + 1 })}`;

  const pinned = { position: "sticky", zIndex: 1, bgcolor: "background.paper" } as const;
  const cellSx = { px: isMobile ? 0.9 : 1.5, py: isMobile ? 1 : 1.25, textAlign: "center", whiteSpace: "nowrap" } as const;
  const selectedStudent = cell ? shown?.students.find((s) => s.id === cell.studentId) : undefined;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {periodLabel}
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={customOpen ? "custom" : view.preset}
          onChange={(_e, preset: PeriodPreset | null) => {
            if (!preset) return;
            // "Custom" only reveals the date fields; picking a date is what reloads.
            setCustomOpen(preset === "custom");
            if (preset !== "custom") setPeriod(preset);
          }}
          sx={{ width: { xs: "100%", sm: "auto" }, "& .MuiToggleButton-root": { flex: { xs: 1, sm: "none" }, px: 1.75 } }}
        >
          <ToggleButton value="today">{t("hifz.period_today")}</ToggleButton>
          <ToggleButton value="week">{t("hifz.period_week")}</ToggleButton>
          <ToggleButton value="month">{t("hifz.period_month")}</ToggleButton>
          <ToggleButton value="custom">{t("hifz.period_custom")}</ToggleButton>
        </ToggleButtonGroup>
        {customOpen && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField type="date" size="small" value={view.from} onChange={(e) => setCustomDate("from", e.target.value)} />
            <span>—</span>
            <TextField type="date" size="small" value={view.to} onChange={(e) => setCustomDate("to", e.target.value)} />
          </Box>
        )}
        <TextField
          select
          size="small"
          value={view.groupId}
          onChange={(e) => onViewChange({ ...view, groupId: e.target.value === "" ? "" : Number(e.target.value) })}
          sx={{ ml: { md: "auto" }, minWidth: 180, flex: { xs: 1, md: "none" } }}
          slotProps={{ select: { displayEmpty: true } }}
        >
          <MenuItem value="">{t("hifz.all_groups")}</MenuItem>
          {(shown?.groups ?? []).map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {error && <Alert severity="error">{apiErrorMessage(error, t("common.error"), t)}</Alert>}
      {shown && shown.groups.length === 0 && <Alert severity="info">{t("hifz.no_groups")}</Alert>}

      {shown && shown.groups.length > 0 && (
        <TableContainer
          component={Paper}
          ref={scrollRef}
          sx={{ overflowX: "auto", overscrollBehaviorX: "contain", opacity: current ? 1 : 0.6, transition: "opacity .15s" }}
        >
          <Table size="small" sx={{ borderCollapse: "separate", borderSpacing: 0, minWidth: isMobile ? 0 : 540 }}>
            <TableHead>
              <TableRow sx={{ "& th": { bgcolor: headBg, color: "text.secondary", fontSize: 12, position: "sticky", top: 0, zIndex: 2, ...cellSx } }}>
                <TableCell sx={{ ...pinned, left: 0, zIndex: "3 !important", width: nameW, minWidth: nameW, maxWidth: nameW, textAlign: "left !important" }}>
                  {t("hifz.col_student")}
                </TableCell>
                <TableCell sx={{ ...pinned, left: nameW, zIndex: "3 !important", width: avgW, minWidth: avgW, boxShadow: `1px 0 0 ${theme.palette.divider}` }}>
                  {t("hifz.col_average")}
                </TableCell>
                <TableCell data-col="exam" sx={{ width: examW, minWidth: examW }}>
                  {t("hifz.col_exam")}
                </TableCell>
                {days.map((d) => (
                  <TableCell
                    key={d}
                    data-day={d}
                    data-today={d === today ? "1" : undefined}
                    sx={{
                      minWidth: isMobile ? 66 : 74,
                      ...(d === today && { bgcolor: `${tint} !important`, color: `${accentInk} !important`, fontWeight: 600 }),
                      ...(dayOfWeek(d) === 7 && d !== today && { color: "text.disabled" }),
                    }}
                  >
                    {fmtShort(d)}
                    <Box component="span" sx={{ display: "block", fontSize: 10.5, opacity: 0.8 }}>
                      {t(`days.${dayOfWeek(d)}`)}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3 + days.length} sx={{ textAlign: "center", color: "text.secondary", py: 3 }}>
                    {t("hifz.no_students")}
                  </TableCell>
                </TableRow>
              )}
              {students.map((s) => {
                const st = stats.get(s.id) ?? NO_STATS;
                const focused = view.focusStudentId === s.id;
                const rowBg = focused ? tint : "background.paper";
                return (
                  <TableRow key={s.id} data-student={s.id} sx={{ "& td": { ...cellSx, bgcolor: rowBg, transition: "background-color .6s" } }}>
                    <TableCell sx={{ ...pinned, bgcolor: `${rowBg} !important`, left: 0, width: nameW, minWidth: nameW, maxWidth: nameW, textAlign: "left !important" }}>
                      <Box
                        component="button"
                        onClick={() => setProfileStudentId(s.id)}
                        sx={{
                          all: "unset",
                          cursor: "pointer",
                          fontWeight: 550,
                          display: "block",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        {s.full_name}
                      </Box>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.4 }}>
                        {KIND_KEYS.map((k) => {
                          const a = shown?.targets.find((x) => x.student_id === s.id && x.kind === k);
                          if (!a) return null;
                          return (
                            <Chip
                              key={k}
                              size="small"
                              color={k === "HIFZ" ? "primary" : "warning"}
                              variant="outlined"
                              label={`${shortOf(k)} ${rangeText(a, units)}`}
                              sx={{ height: 18, fontSize: 10.5, "& .MuiChip-label": { px: 0.6 } }}
                            />
                          );
                        })}
                        {!shown?.targets.some((x) => x.student_id === s.id) && (
                          <Typography component="span" sx={{ fontSize: 10.5, color: "text.disabled" }}>
                            {t("hifz.no_target")}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...pinned, bgcolor: `${rowBg} !important`, left: nameW, width: avgW, minWidth: avgW, boxShadow: `1px 0 0 ${theme.palette.divider}` }}>
                      {st.avg != null ? (
                        <Chip size="small" color={LEVEL_CHIP[level(st.avg)]} label={`${Math.round(st.avg)}%`} sx={{ fontWeight: 600 }} />
                      ) : (
                        <Typography component="span" color="text.disabled">—</Typography>
                      )}
                      <Box sx={{ fontSize: 10.5, color: "text.secondary", mt: 0.3 }}>{t("hifz.days_count", { count: st.days })}</Box>
                    </TableCell>
                    <TableCell
                      onClick={() => setExamsStudent({ id: s.id, name: s.full_name })}
                      sx={{ cursor: "pointer", "&:hover": { bgcolor: `${tint} !important` } }}
                    >
                      {st.exam != null ? (
                        <>
                          <Chip size="small" color={LEVEL_CHIP[level(st.exam)]} variant="outlined" label={`${Math.round(st.exam)}%`} />
                          <Box sx={{ fontSize: 10.5, color: "text.secondary", mt: 0.3 }}>
                            {t("hifz.exams_count", { count: st.examCount })}
                          </Box>
                        </>
                      ) : shown?.can_edit ? (
                        <AddIcon fontSize="small" sx={{ color: "text.disabled" }} />
                      ) : (
                        <Typography component="span" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    {days.map((d) => (
                      <TableCell
                        key={d}
                        onClick={() => setCell({ studentId: s.id, date: d })}
                        sx={{
                          cursor: "pointer",
                          px: "6px !important",
                          py: "7px !important",
                          ...(d === today && { bgcolor: `${tint} !important` }),
                          "&:hover": { bgcolor: `${d === today ? tint2 : tint} !important` },
                        }}
                      >
                        {KIND_KEYS.map((k) => {
                          const r = recordIndex.get(`${s.id}|${d}|${k}`);
                          return (
                            <Box key={k} sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6, position: "relative", lineHeight: 1.35 }}>
                              <Box component="i" sx={{ fontStyle: "normal", fontSize: 9.5, fontWeight: 620, color: "text.disabled", width: 10, textAlign: "right" }}>
                                {shortOf(k)}
                              </Box>
                              <Box
                                component="b"
                                sx={{
                                  fontSize: 13,
                                  fontWeight: r ? 580 : 400,
                                  minWidth: 22,
                                  textAlign: "left",
                                  fontVariantNumeric: "tabular-nums",
                                  color: !r ? "text.disabled" : r.score == null ? "text.secondary" : LEVEL_COLOR[level(r.score)],
                                }}
                              >
                                {!r ? "·" : r.score == null ? "—" : Math.round(r.score)}
                              </Box>
                              {r?.comment && (
                                <Box
                                  component="span"
                                  title={r.comment}
                                  sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "text.secondary", position: "absolute", right: 0, top: 6 }}
                                />
                              )}
                            </Box>
                          );
                        })}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {students.length > 0 && (
                <TableRow sx={{ "& td": { ...cellSx, bgcolor: headBg, color: "text.secondary", fontSize: 12.5 } }}>
                  <TableCell sx={{ ...pinned, left: 0, textAlign: "left !important" }}>{t("hifz.day_average")}</TableCell>
                  <TableCell sx={{ ...pinned, left: nameW, boxShadow: `1px 0 0 ${theme.palette.divider}` }} />
                  <TableCell />
                  {days.map((d) => {
                    const v = dayAverages.get(d);
                    return (
                      <TableCell key={d} sx={{ fontWeight: 600, ...(v && { color: `${LEVEL_COLOR[level(v.sum / v.n)]} !important` }) }}>
                        {v ? `${Math.round(v.sum / v.n)}%` : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1.5, fontSize: 12.5, color: "text.secondary" }}>
        <span>
          <b>{shortOf("HIFZ")}</b> — {t("hifz.kind_hifz")}
        </span>
        <span>
          <b>{shortOf("REPEAT")}</b> — {t("hifz.kind_repeat")}
        </span>
        <span>{shown?.can_edit ? t("hifz.legend_click_to_grade") : t("hifz.legend_click_to_view")}</span>
      </Box>

      {cell && selectedStudent && shown && (
        <HifzDayDialog
          student={{ id: selectedStudent.id, name: selectedStudent.full_name, group: groupName(selectedStudent.group_id) }}
          date={cell.date}
          records={{
            HIFZ: recordIndex.get(`${cell.studentId}|${cell.date}|HIFZ`) ?? null,
            REPEAT: recordIndex.get(`${cell.studentId}|${cell.date}|REPEAT`) ?? null,
          }}
          targets={shown.targets}
          readOnly={!shown.can_edit}
          onClose={() => setCell(null)}
          onSaved={(msg) => {
            refresh();
            setCell(null);
            setSnackbar(msg);
          }}
          onError={(err) => setSnackbar(apiErrorMessage(err, t("hifz.save_failed"), t))}
        />
      )}
      {examsStudent && (
        <HifzExamsDialog
          student={examsStudent}
          period={{ from: view.from, to: view.to }}
          readOnly={!shown?.can_edit}
          onClose={() => setExamsStudent(null)}
          onChanged={refresh}
          onError={setSnackbar}
        />
      )}
      {profileStudentId && <StudentProfileDialog studentId={profileStudentId} onClose={() => setProfileStudentId(null)} />}
      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}

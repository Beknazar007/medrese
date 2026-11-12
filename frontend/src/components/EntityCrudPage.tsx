import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../context/ConfirmContext";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { apiErrorMessage } from "../lib/errors";

export type FieldType = "text" | "number" | "select" | "date" | "time" | "checkbox" | "image";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string | number; label: string }[];
  required?: boolean;
  requiredOnCreateOnly?: boolean; // e.g. password — mandatory when creating, optional when editing (blank = keep unchanged)
  multiline?: boolean; // for long free text (type "text")
  editableOnCreateOnly?: boolean; // e.g. username — shown only when creating
  editHelperText?: string; // shown only while editing, e.g. "leave blank to keep the current password"
  hidden?: (values: Record<string, unknown>) => boolean;
}

// Downscales + re-encodes as JPEG client-side before it's stored as a base64 string,
// so an uploaded photo never bloats the record — a phone photo becomes a few dozen KB.
async function resizeImageToDataUrl(file: File, maxDim = 400, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Rows rendered at first; "show more" adds this many again. Search still covers every row. */
const PAGE_SIZE = 30;

function isEmptyCell(value: ReactNode): boolean {
  return value === null || value === undefined || value === "" || value === "—" || value === false;
}

export interface ColumnConfig<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface EntityApi<T> {
  list: (params?: Record<string, unknown>) => Promise<T[]>;
  create?: (payload: Record<string, unknown>) => Promise<T>;
  update?: (id: number, payload: Record<string, unknown>) => Promise<T>;
  remove?: (id: number) => Promise<void>;
}

interface Props<T extends { id: number }> {
  title: string;
  queryKey: unknown[];
  listParams?: Record<string, unknown>;
  api: EntityApi<T>;
  columns: ColumnConfig<T>[];
  fields?: FieldConfig[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  defaultValues?: Record<string, unknown>;
  extraToolbar?: ReactNode;
  emptyHint?: string;
  searchPlaceholder?: string;
  /** When set, clicking a row calls this instead of opening the edit dialog (e.g. a read-only detail view). Edit/delete icon buttons keep working independently. */
  onRowClick?: (row: T) => void;
  /** When a plain delete is refused (409 — the row still has dependent records), ask a second,
   *  destructive confirmation with this message and, if accepted, delete via `remove`. */
  forceDelete?: {
    confirmMessage: (id: number) => Promise<string>;
    remove: (id: number) => Promise<void>;
  };
  /** A warning about what the change will do (e.g. a teacher replaced in all future lessons).
   *  Saving asks "Save changes?" only when this returns text; ordinary saves go straight through,
   *  since they are easy to fix. `editingRow` is null when creating. */
  confirmMessage?: (values: Record<string, unknown>, editingRow: T | null) => string | undefined;
  /** Extra checks before saving: field name → message shown under that field. Wins over the
   *  generic "required" text, so a page can phrase its own. */
  validate?: (values: Record<string, unknown>) => Record<string, string>;
  /** Question in the delete confirmation instead of the generic "Delete this record?". */
  deleteConfirmText?: string;
  /** On wide screens, show "Edit" / "Delete" as labelled buttons rather than bare icons. */
  labeledActions?: boolean;
}

function isBlank(value: unknown): boolean {
  return value === "" || value === undefined || value === null;
}

export default function EntityCrudPage<T extends { id: number }>({
  title,
  queryKey,
  listParams,
  api,
  columns,
  fields = [],
  canCreate = true,
  canEdit = true,
  canDelete = true,
  defaultValues = {},
  extraToolbar,
  emptyHint,
  searchPlaceholder,
  onRowClick,
  forceDelete,
  confirmMessage,
  validate,
  deleteConfirmText,
  labeledActions = false,
}: Props<T>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const runOnce = useSingleFlight();
  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKey, listParams],
    queryFn: () => api.list(listParams),
  });

  const [search, setSearch] = useState("");
  const filteredData = useMemo(() => {
    if (!data) return data;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [data, search]);

  // Drawing hundreds of rows at once made the students page ~88,000px tall on a phone and slow
  // to open; show a page at a time. A new search starts from the top again.
  const pageKey = JSON.stringify([search, listParams ?? null]);
  const [paging, setPaging] = useState({ key: pageKey, count: PAGE_SIZE });
  const visibleCount = paging.key === pageKey ? paging.count : PAGE_SIZE;
  const visibleData = filteredData?.slice(0, visibleCount);
  const hiddenCount = Math.max(0, (filteredData?.length ?? 0) - visibleCount);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<T | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  function openCreate() {
    setEditingRow(null);
    setFormValues({ ...defaultValues });
    setFormError(null);
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(row: T) {
    setEditingRow(row);
    setFormValues({ ...row });
    setFormError(null);
    setFieldErrors({});
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  // Server validation errors name payload fields; show them with the labels the user sees.
  const fieldLabels = Object.fromEntries(fields.map((f) => [f.name, f.label]));

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.create!(payload),
    onSuccess: () => {
      invalidate();
      setSnackbar(t("common.created"));
      closeDialog();
    },
    onError: (err) => setFormError(apiErrorMessage(err, t("common.failed_to_create"), t, fieldLabels)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.update!(editingRow!.id, payload),
    onSuccess: () => {
      invalidate();
      setSnackbar(t("common.saved"));
      closeDialog();
    },
    onError: (err) => setFormError(apiErrorMessage(err, t("common.failed_to_save"), t, fieldLabels)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.remove!(id),
    onError: async (err, id) => {
      setPendingDeleteId(null);
      if (forceDelete && axios.isAxiosError(err) && err.response?.status === 409) {
        try {
          const ok = await confirm({
            message: await forceDelete.confirmMessage(id),
            destructive: true,
            confirmLabel: t("common.force_remove_label"),
          });
          if (ok) forceDeleteMutation.mutate(id);
        } catch (countErr) {
          setSnackbar(apiErrorMessage(countErr, t("common.failed_to_delete"), t));
        }
        return;
      }
      setSnackbar(apiErrorMessage(err, t("common.failed_to_delete"), t));
    },
    onSuccess: () => {
      invalidate();
      setSnackbar(t("common.deleted"));
      setPendingDeleteId(null);
    },
  });

  const forceDeleteMutation = useMutation({
    mutationFn: (id: number) => forceDelete!.remove(id),
    onSuccess: () => {
      invalidate();
      setSnackbar(t("common.deleted"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("common.failed_to_delete"), t)),
  });

  function isFieldShown(field: FieldConfig): boolean {
    return !field.hidden?.(formValues) && !(editingRow && field.editableOnCreateOnly);
  }

  function isFieldRequired(field: FieldConfig): boolean {
    return Boolean(field.required) && !(field.requiredOnCreateOnly && editingRow);
  }

  async function handleSubmit() {
    // Check required fields before any request or question, so an incomplete form is
    // highlighted right away instead of being rejected by the server.
    const missing: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "checkbox" || !isFieldShown(field) || !isFieldRequired(field)) continue;
      if (isBlank(formValues[field.name])) missing[field.name] = t("validation.required");
    }
    Object.assign(missing, validate?.(formValues) ?? {});
    setFieldErrors(missing);
    if (Object.keys(missing).length > 0) return;

    await runOnce(async () => {
      const extra = confirmMessage?.(formValues, editingRow);
      if (extra) {
        const ok = await confirm({ message: `${extra}. ${t("common.confirm_save")}` });
        if (!ok) return;
      }
      setFormError(null);
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        if (!isFieldShown(field)) continue;
        const raw = formValues[field.name];
        // A switch is saved exactly as it is shown: an untouched one is off, not "unknown".
        if (field.type === "checkbox") payload[field.name] = Boolean(raw);
        else payload[field.name] = isBlank(raw) ? null : raw;
      }
      // Errors are shown by the mutations' onError; the catch only stops an unhandled rejection.
      if (editingRow) await updateMutation.mutateAsync(payload).catch(() => {});
      else await createMutation.mutateAsync(payload).catch(() => {});
    });
  }

  function setField(name: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  const busy = createMutation.isPending || updateMutation.isPending;

  const hasRows = Boolean(data && data.length > 0);

  return (
    <Box>
      {/* On phones the title, filters, add button and search stay pinned under the app bar,
          so changing the group or searching doesn't require scrolling back to the top. */}
      <Box
        sx={{
          position: { xs: "sticky", sm: "static" },
          top: { xs: "calc(56px + env(safe-area-inset-top))", sm: "auto" },
          zIndex: 2,
          bgcolor: "background.default",
          mx: { xs: -2, sm: 0 },
          px: { xs: 2, sm: 0 },
          pt: { xs: 1, sm: 0 },
          pb: { xs: 1, sm: 0 },
          mb: { xs: 1.5, sm: 0 },
          borderBottom: { xs: 1, sm: 0 },
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: { xs: 1, sm: 2 }, gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h5">
            {title}
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 1,
              flexWrap: { xs: "nowrap", sm: "wrap" },
              width: { xs: "100%", sm: "auto" },
              "& > :first-of-type:not(:only-child)": { flex: { xs: 1, sm: "initial" }, minWidth: { xs: 0, sm: undefined } },
            }}
          >
            {extraToolbar}
            {canCreate && api.create && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>
                {t("common.add")}
              </Button>
            )}
          </Box>
        </Box>

        {hasRows && (
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? t("common.search")}
            sx={{ mb: { xs: 0, sm: 1.5 }, maxWidth: { xs: "none", sm: 320 } }}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      </Box>

      {error && <Alert severity="error">{t("common.failed_to_load")}</Alert>}
      {isLoading && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }} aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={isMobile ? 88 : 40} />
          ))}
        </Box>
      )}
      {!isLoading && !error && data && data.length === 0 && (
        <Alert
          severity="info"
          action={
            canCreate && api.create ? (
              <Button color="inherit" size="small" onClick={openCreate}>
                {t("common.add")}
              </Button>
            ) : undefined
          }
        >
          {emptyHint ?? t("common.no_records")}
        </Alert>
      )}

      {hasRows && (
        <>
          {filteredData && filteredData.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t("common.no_search_results")}
            </Alert>
          )}

          {/* Phones: one card per row — a wide table would hide most columns off-screen. */}
          {isMobile && filteredData && filteredData.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {visibleData!.map((row) => {
                const rowIsClickable = onRowClick ? true : canEdit && Boolean(api.update);
                const handleRowClick = onRowClick ? () => onRowClick(row) : () => openEdit(row);
                const cell = (col: ColumnConfig<T>) =>
                  col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—");
                const unlabeled = columns.filter((c) => !c.label);
                const [titleCol, ...restCols] = columns.filter((c) => c.label);
                return (
                  <Paper
                    key={row.id}
                    variant="outlined"
                    onClick={rowIsClickable ? handleRowClick : undefined}
                    sx={{ p: 1.5, cursor: rowIsClickable ? "pointer" : undefined }}
                  >
                    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                      {unlabeled.map((col) => (
                        <Box key={col.key} sx={{ flexShrink: 0 }}>
                          {cell(col)}
                        </Box>
                      ))}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {titleCol && <Box sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{cell(titleCol)}</Box>}
                        {/* Empty fields ("Phone: —") are left out — they only made every card taller. */}
                        {restCols.map((col) => {
                          const value = cell(col);
                          if (isEmptyCell(value)) return null;
                          return (
                            <Box key={col.key} sx={{ fontSize: 13, color: "text.secondary", mt: 0.25, overflowWrap: "anywhere" }}>
                              {col.label}:{" "}
                              <Box component="span" sx={{ color: "text.primary" }}>
                                {value}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                    {/* Labeled, thumb-sized buttons along the bottom instead of tiny icons in the corner. */}
                    {((canEdit && api.update) || (canDelete && api.remove)) && (
                      <Box sx={{ display: "flex", gap: 1, mt: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
                        {canEdit && api.update && (
                          <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            sx={{ flex: 1, minHeight: 44, fontSize: 15, "& .MuiButton-startIcon > svg": { fontSize: 24 } }}
                            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                          >
                            {t("common.edit")}
                          </Button>
                        )}
                        {canDelete && api.remove && (
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            sx={{ flex: 1, minHeight: 44, fontSize: 15, "& .MuiButton-startIcon > svg": { fontSize: 24 } }}
                            onClick={(e) => { e.stopPropagation(); setPendingDeleteId(row.id); }}
                          >
                            {t("common.remove")}
                          </Button>
                        )}
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )}

          {!isMobile && filteredData && filteredData.length > 0 && (
            <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell key={col.key} sx={{ whiteSpace: "nowrap" }}>
                        {col.label}
                      </TableCell>
                    ))}
                    {(canEdit || canDelete) && (
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {t("common.actions")}
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleData!.map((row) => {
                    const rowIsClickable = onRowClick ? true : canEdit && Boolean(api.update);
                    const handleRowClick = onRowClick ? () => onRowClick(row) : () => openEdit(row);
                    return (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={rowIsClickable ? handleRowClick : undefined}
                      sx={rowIsClickable ? { cursor: "pointer" } : undefined}
                    >
                      {columns.map((col) => (
                        <TableCell key={col.key} sx={{ whiteSpace: "nowrap" }}>
                          {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                        </TableCell>
                      ))}
                      {(canEdit || canDelete) && (
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {labeledActions && canEdit && api.update && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon />}
                              sx={{ minHeight: 40, mr: 1 }}
                              onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                            >
                              {t("common.edit")}
                            </Button>
                          )}
                          {labeledActions && canDelete && api.remove && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<DeleteIcon />}
                              sx={{ minHeight: 40 }}
                              onClick={(e) => { e.stopPropagation(); setPendingDeleteId(row.id); }}
                            >
                              {t("common.remove")}
                            </Button>
                          )}
                          {!labeledActions && canEdit && api.update && (
                            <IconButton
                              size="small"
                              aria-label={t("common.edit")}
                              title={t("common.edit")}
                              onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          )}
                          {!labeledActions && canDelete && api.remove && (
                            <IconButton
                              size="small"
                              aria-label={t("common.remove")}
                              title={t("common.remove")}
                              onClick={(e) => { e.stopPropagation(); setPendingDeleteId(row.id); }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {hiddenCount > 0 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button variant="outlined" onClick={() => setPaging({ key: pageKey, count: visibleCount + PAGE_SIZE })} sx={{ minWidth: 220 }}>
                {t("common.show_more", { count: Math.min(PAGE_SIZE, hiddenCount), total: hiddenCount })}
              </Button>
            </Box>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          {editingRow ? t("common.edit_title", { title }) : t("common.new_title", { title })}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {fields.map((field) => {
            if (field.hidden?.(formValues)) return null;
            if (editingRow && field.editableOnCreateOnly) return null;

            const value = formValues[field.name] ?? "";
            const isRequired = isFieldRequired(field);
            const fieldError = fieldErrors[field.name];

            if (field.type === "select") {
              const options = field.options ?? [];
              const selected = options.find((opt) => opt.value === value) ?? null;
              return (
                <Autocomplete
                  key={field.name}
                  options={options}
                  value={selected}
                  isOptionEqualToValue={(opt, val) => opt.value === val.value}
                  getOptionLabel={(opt) => opt.label}
                  onChange={(_e, newValue) => setField(field.name, newValue ? newValue.value : "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={field.label}
                      required={isRequired}
                      error={Boolean(fieldError)}
                      helperText={fieldError}
                    />
                  )}
                  fullWidth
                />
              );
            }

            if (field.type === "checkbox") {
              return (
                <FormControlLabel
                  key={field.name}
                  control={
                    <Switch checked={Boolean(value)} onChange={(e) => setField(field.name, e.target.checked)} />
                  }
                  label={field.label}
                />
              );
            }

            if (field.type === "image") {
              const photoValue = typeof value === "string" && value ? value : null;
              return (
                <Box key={field.name} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar src={photoValue ?? undefined} sx={{ width: 64, height: 64 }} />
                  <Button component="label" variant="outlined" size="small">
                    {field.label}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        const dataUrl = await resizeImageToDataUrl(file);
                        setField(field.name, dataUrl);
                      }}
                    />
                  </Button>
                  {photoValue && (
                    <Button size="small" color="error" onClick={() => setField(field.name, null)}>
                      {t("common.remove")}
                    </Button>
                  )}
                </Box>
              );
            }

            return (
              <TextField
                key={field.name}
                label={field.label}
                type={field.type === "date" ? "date" : field.type === "time" ? "time" : field.type}
                value={value}
                required={isRequired}
                error={Boolean(fieldError)}
                multiline={field.multiline}
                minRows={field.multiline ? 3 : undefined}
                onChange={(e) =>
                  setField(
                    field.name,
                    // A cleared number stays empty instead of turning into 0 (Number("") === 0).
                    field.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value,
                  )
                }
                helperText={fieldError ?? (editingRow ? field.editHelperText : undefined)}
                slotProps={{ inputLabel: { shrink: field.type === "date" || field.type === "time" ? true : undefined } }}
                fullWidth
              />
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={busy}>
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{deleteConfirmText ?? t("common.confirm_delete")}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setPendingDeleteId(null)}>{t("common.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => pendingDeleteId !== null && deleteMutation.mutate(pendingDeleteId)}
          >
            {t("common.remove")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2500}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}

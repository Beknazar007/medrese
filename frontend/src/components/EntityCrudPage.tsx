import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Autocomplete,
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
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "../lib/errors";

export type FieldType = "text" | "number" | "select" | "date" | "time" | "checkbox";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string | number; label: string }[];
  required?: boolean;
  editableOnCreateOnly?: boolean; // e.g. username — shown only when creating
  hidden?: (values: Record<string, unknown>) => boolean;
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
}: Props<T>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<T | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  function openCreate() {
    setEditingRow(null);
    setFormValues({ ...defaultValues });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(row: T) {
    setEditingRow(row);
    setFormValues({ ...row });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.create!(payload),
    onSuccess: () => {
      invalidate();
      setSnackbar(t("common.created"));
      closeDialog();
    },
    onError: (err) => setFormError(apiErrorMessage(err, t("common.failed_to_create"))),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.update!(editingRow!.id, payload),
    onSuccess: () => {
      invalidate();
      setSnackbar(t("common.saved"));
      closeDialog();
    },
    onError: (err) => setFormError(apiErrorMessage(err, t("common.failed_to_save"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.remove!(id),
    onSuccess: () => {
      invalidate();
      setSnackbar(t("common.deleted"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("common.failed_to_delete"))),
    onSettled: () => setPendingDeleteId(null),
  });

  function handleSubmit() {
    setFormError(null);
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.hidden?.(formValues)) continue;
      if (editingRow && field.editableOnCreateOnly) continue;
      const raw = formValues[field.name];
      payload[field.name] = raw === "" || raw === undefined ? null : raw;
    }
    if (editingRow) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  function setField(name: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
          {title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {extraToolbar}
          {canCreate && api.create && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {t("common.add")}
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error">{t("common.failed_to_load")}</Alert>}
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

      {data && data.length > 0 && (
        <>
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? t("common.search")}
            sx={{ mb: 1.5, maxWidth: 320 }}
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

          {filteredData && filteredData.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t("common.no_search_results")}
            </Alert>
          )}

          {filteredData && filteredData.length > 0 && (
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
                  {filteredData.map((row) => (
                    <TableRow key={row.id} hover>
                      {columns.map((col) => (
                        <TableCell key={col.key} sx={{ whiteSpace: "nowrap" }}>
                          {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                        </TableCell>
                      ))}
                      {(canEdit || canDelete) && (
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {canEdit && api.update && (
                            <IconButton size="small" onClick={() => openEdit(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          )}
                          {canDelete && api.remove && (
                            <IconButton size="small" onClick={() => setPendingDeleteId(row.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
                  renderInput={(params) => <TextField {...params} label={field.label} required={field.required} />}
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

            return (
              <TextField
                key={field.name}
                label={field.label}
                type={field.type === "date" ? "date" : field.type === "time" ? "time" : field.type}
                value={value}
                required={field.required}
                onChange={(e) =>
                  setField(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)
                }
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
        <DialogTitle>{t("common.confirm_delete")}</DialogTitle>
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

import DashboardIcon from "@mui/icons-material/Dashboard";
import EventNoteIcon from "@mui/icons-material/EventNote";
import GroupsIcon from "@mui/icons-material/Groups";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PeopleIcon from "@mui/icons-material/People";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import ClassIcon from "@mui/icons-material/Class";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuItem,
  Select,
  Snackbar,
  Toolbar,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { hifzApi, scheduleApi } from "./api/entities";
import ChangePasswordDialog from "./components/ChangePasswordDialog";
import { useAuth } from "./context/AuthContext";
import { useConfirm } from "./context/ConfirmContext";
import { useColorMode } from "./hooks/useColorMode";

const DRAWER_WIDTH = 230;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

interface NavGroup {
  label?: string; // omitted for the ungrouped top item (Dashboard)
  items: NavItem[];
}

export default function Layout() {
  const { t, i18n } = useTranslation();
  const colorMode = useColorMode();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [dismissedNow, setDismissedNow] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // A teacher only sees the journal(s) they actually use: the hifz journal for hafiz groups,
  // "my class" for everything else. Until both lists load, show both rather than flicker.
  const isTeacher = user?.role === "TEACHER";
  const { data: myHifzGroups } = useQuery({ queryKey: ["hifz-groups"], queryFn: () => hifzApi.groups(), enabled: isTeacher });
  const { data: myEntries } = useQuery({ queryKey: ["schedule", "mine"], queryFn: () => scheduleApi.list(), enabled: isTeacher });
  const teachersLoaded = Boolean(myHifzGroups && myEntries);
  const hasHifzClasses = !teachersLoaded || (myHifzGroups ?? []).length > 0;
  const hasRegularClasses =
    !teachersLoaded ||
    (myEntries ?? []).some((e) => !(myHifzGroups ?? []).some((g) => g.id === e.group_id)) ||
    (myHifzGroups ?? []).length === 0;

  const bannerKey = user?.id != null ? `pwd_prompt_dismissed_${user.id}` : null;
  const bannerDismissed = dismissedNow || (bannerKey !== null && readSession(bannerKey) === "1");

  function dismissBanner() {
    if (bannerKey) writeSession(bannerKey, "1");
    setDismissedNow(true);
  }

  const roleLabel = user ? t(`users.role_${user.role.toLowerCase()}`) : "";

  const showRecommendBanner = Boolean(user?.must_change_password) && !bannerDismissed;

  async function handleLogout() {
    const ok = await confirm({ message: t("nav.logout_confirm"), confirmLabel: t("nav.logout") });
    if (!ok) return;
    logout();
    navigate("/login");
  }

  const navGroups: NavGroup[] = [];

  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    navGroups.push({ items: [{ to: "/dashboard", label: t("nav.dashboard"), icon: <DashboardIcon /> }] });
  }

  const orgItems: NavItem[] = [];
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    orgItems.push({ to: "/departments", label: t("nav.departments"), icon: <AccountTreeIcon /> });
  }
  if (user?.role === "RECTOR") {
    orgItems.push({ to: "/users", label: t("nav.admin_accounts"), icon: <AdminPanelSettingsIcon /> });
  }
  if (orgItems.length) navGroups.push({ label: t("nav.group_org"), items: orgItems });

  const academicItems: NavItem[] = [];
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    academicItems.push(
      { to: "/teachers", label: t("nav.teachers"), icon: <PeopleIcon /> },
      { to: "/students", label: t("nav.students"), icon: <SchoolIcon /> },
      { to: "/excuses", label: t("nav.excuses"), icon: <EventBusyIcon /> },
      { to: "/subjects", label: t("nav.subjects"), icon: <MenuBookIcon /> },
      { to: "/groups", label: t("nav.groups"), icon: <GroupsIcon /> },
      { to: "/assignments", label: t("nav.assignments"), icon: <AssignmentIcon /> },
    );
  }
  if (academicItems.length) navGroups.push({ label: t("nav.group_academic"), items: academicItems });

  const monitoringItems: NavItem[] = [];
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    monitoringItems.push({ to: "/monitoring", label: t("nav.monitoring"), icon: <FactCheckIcon /> });
    // Read-only for rector/dean: the students × days gradebook and assignments.
    monitoringItems.push({ to: "/hifz-journal", label: t("nav.hifz_journal"), icon: <MenuBookIcon /> });
  }
  if (monitoringItems.length) navGroups.push({ label: t("nav.group_monitoring"), items: monitoringItems });

  const scheduleItems: NavItem[] = [];
  if (user?.role === "TEACHER") {
    if (hasRegularClasses) scheduleItems.push({ to: "/my-class", label: t("nav.my_class"), icon: <ClassIcon /> });
    if (hasHifzClasses) scheduleItems.push({ to: "/hifz-journal", label: t("nav.hifz_journal"), icon: <MenuBookIcon /> });
  }
  scheduleItems.push({ to: "/schedule", label: t("nav.schedule"), icon: <EventNoteIcon /> });
  if (user?.role === "RECTOR") {
    scheduleItems.push(
      { to: "/semesters", label: t("nav.semesters"), icon: <CalendarMonthIcon /> },
      { to: "/rooms", label: t("nav.rooms"), icon: <MeetingRoomIcon /> },
      { to: "/timeslots", label: t("nav.timeslots"), icon: <EventNoteIcon /> },
    );
  }
  navGroups.push({ label: t("nav.group_schedule"), items: scheduleItems });

  const drawerContent = (
    <List>
      {isMobile && (
        <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {user?.username}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {roleLabel}
          </Typography>
        </Box>
      )}
      {isMobile && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Select
            size="small"
            fullWidth
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            <MenuItem value="ky">Кыргызча</MenuItem>
            <MenuItem value="ru">Русский</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </Select>
        </Box>
      )}
      {navGroups.map((group, i) => (
        <Box key={group.label ?? `group-${i}`}>
          {i > 0 && <Divider sx={{ my: 0.5 }} />}
          {group.label && (
            <ListSubheader sx={{ lineHeight: "32px", fontSize: 12, fontWeight: 600 }}>{group.label}</ListSubheader>
          )}
          {group.items.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={() => isMobile && setMobileOpen(false)}
              sx={{
                mx: 1,
                borderRadius: 1.5,
                "&.active": {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  color: "primary.main",
                  "& .MuiListItemIcon-root": { color: "primary.main" },
                  "& .MuiListItemText-primary": { fontWeight: 600 },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </Box>
      ))}
      {isMobile && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <ListItemButton
            sx={{ mx: 1, borderRadius: 1.5 }}
            onClick={() => {
              setMobileOpen(false);
              setChangePasswordOpen(true);
            }}
          >
            <ListItemIcon>
              <VpnKeyIcon />
            </ListItemIcon>
            <ListItemText primary={t("nav.change_password")} />
          </ListItemButton>
        </>
      )}
    </List>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, pt: "env(safe-area-inset-top)" }}
      >
        <Toolbar sx={{ gap: { xs: 1, sm: 2 } }}>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }} aria-label={t("nav.menu")}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            noWrap
            sx={{ flexGrow: 1, fontSize: { xs: "1rem", sm: "1.25rem" }, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {isMobile ? t("app_short_title") : t("app_title")}
          </Typography>
          <Select
            size="small"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            sx={{ color: "inherit", ".MuiSvgIcon-root": { color: "inherit" }, display: { xs: "none", sm: "inline-flex" } }}
          >
            <MenuItem value="ky">Кыргызча</MenuItem>
            <MenuItem value="ru">Русский</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </Select>
          <Typography variant="body2" sx={{ display: { xs: "none", md: "block" } }}>
            {user?.username} · {roleLabel}
          </Typography>
          <IconButton
            color="inherit"
            onClick={colorMode.toggle}
            aria-label={colorMode.mode === "dark" ? t("nav.light_mode") : t("nav.dark_mode")}
            title={colorMode.mode === "dark" ? t("nav.light_mode") : t("nav.dark_mode")}
          >
            {colorMode.mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => setChangePasswordOpen(true)}
            aria-label={t("nav.change_password")}
            title={t("nav.change_password")}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            <VpnKeyIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={handleLogout}
            sx={{ display: { xs: "inline-flex", sm: "none" } }}
            aria-label={t("nav.logout")}
            title={t("nav.logout")}
          >
            <LogoutIcon />
          </IconButton>
          <ListItemButton
            onClick={handleLogout}
            sx={{ width: "auto", borderRadius: 1, display: { xs: "none", sm: "flex" } }}
          >
            {t("nav.logout")}
          </ListItemButton>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" } }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
          maxWidth: "100%",
          overflowX: "clip",
        }}
      >
        <Toolbar sx={{ pt: "env(safe-area-inset-top)" }} />
        {showRecommendBanner && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={dismissBanner}>
                {t("password.recommend_dismiss")}
              </Button>
            }
          >
            {t("password.recommend_banner")}{" "}
            <Button size="small" onClick={() => setChangePasswordOpen(true)}>
              {t("password.recommend_action")}
            </Button>
          </Alert>
        )}
        <Suspense fallback={<LinearProgress sx={{ mt: 1 }} />}>
          <Outlet />
        </Suspense>
      </Box>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onChanged={() => {
          dismissBanner();
          setPasswordChanged(true);
        }}
      />
      {/* Shown here, not in the dialog: the dialog closes on success and would take the message with it. */}
      <Snackbar
        open={passwordChanged}
        autoHideDuration={4000}
        onClose={() => setPasswordChanged(false)}
        message={t("password.changed")}
      />
    </Box>
  );
}

// sessionStorage can throw (private mode, blocked storage) — the banner then simply shows again.
function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

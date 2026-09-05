import DashboardIcon from "@mui/icons-material/Dashboard";
import EventNoteIcon from "@mui/icons-material/EventNote";
import GroupsIcon from "@mui/icons-material/Groups";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PeopleIcon from "@mui/icons-material/People";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ApartmentIcon from "@mui/icons-material/Apartment";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AssignmentIcon from "@mui/icons-material/Assignment";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const DRAWER_WIDTH = 230;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navItems: NavItem[] = [];
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    navItems.push({ to: "/dashboard", label: t("nav.dashboard"), icon: <DashboardIcon /> });
  }
  if (user?.role === "RECTOR") {
    navItems.push({ to: "/faculties", label: t("nav.faculties"), icon: <ApartmentIcon /> });
  }
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    navItems.push({ to: "/departments", label: t("nav.departments"), icon: <AccountTreeIcon /> });
  }
  if (user?.role === "RECTOR") {
    navItems.push({ to: "/users", label: t("nav.admin_accounts"), icon: <AdminPanelSettingsIcon /> });
  }
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    navItems.push(
      { to: "/teachers", label: t("nav.teachers"), icon: <PeopleIcon /> },
      { to: "/subjects", label: t("nav.subjects"), icon: <MenuBookIcon /> },
      { to: "/groups", label: t("nav.groups"), icon: <GroupsIcon /> },
      { to: "/assignments", label: t("nav.assignments"), icon: <AssignmentIcon /> },
    );
  }
  if (user?.role === "RECTOR") {
    navItems.push(
      { to: "/semesters", label: t("nav.semesters"), icon: <CalendarMonthIcon /> },
      { to: "/rooms", label: t("nav.rooms"), icon: <MeetingRoomIcon /> },
      { to: "/timeslots", label: t("nav.timeslots"), icon: <EventNoteIcon /> },
    );
  }
  navItems.push({ to: "/schedule", label: t("nav.schedule"), icon: <EventNoteIcon /> });

  const drawerContent = (
    <List>
      {isMobile && (
        <Box sx={{ px: 2, py: 1.5 }}>
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
      {navItems.map((item) => (
        <ListItemButton
          key={item.to}
          component={NavLink}
          to={item.to}
          onClick={() => isMobile && setMobileOpen(false)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: { xs: 1, sm: 2 } }}>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            noWrap
            sx={{ flexGrow: 1, fontSize: { xs: "1rem", sm: "1.25rem" }, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {t("app_title")}
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
            {user?.username} ({user?.role})
          </Typography>
          <IconButton
            color="inherit"
            onClick={handleLogout}
            sx={{ display: { xs: "inline-flex", sm: "none" } }}
            aria-label={t("nav.logout")}
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
          overflowX: "hidden",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

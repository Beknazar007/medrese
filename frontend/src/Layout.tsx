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
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from "@mui/material";
import { type ReactNode } from "react";
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

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navItems: NavItem[] = [];
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    navItems.push({ to: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> });
  }
  if (user?.role === "RECTOR") {
    navItems.push({ to: "/faculties", label: "Faculties", icon: <ApartmentIcon /> });
  }
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    navItems.push({ to: "/departments", label: "Departments", icon: <AccountTreeIcon /> });
  }
  if (user?.role === "RECTOR") {
    navItems.push({ to: "/users", label: "Admin accounts", icon: <AdminPanelSettingsIcon /> });
  }
  if (user?.role === "RECTOR" || user?.role === "DEAN") {
    navItems.push(
      { to: "/teachers", label: t("nav.teachers"), icon: <PeopleIcon /> },
      { to: "/subjects", label: "Subjects", icon: <MenuBookIcon /> },
      { to: "/groups", label: "Groups", icon: <GroupsIcon /> },
      { to: "/assignments", label: "Assignments", icon: <AssignmentIcon /> },
    );
  }
  if (user?.role === "RECTOR") {
    navItems.push(
      { to: "/semesters", label: "Semesters", icon: <CalendarMonthIcon /> },
      { to: "/rooms", label: "Rooms", icon: <MeetingRoomIcon /> },
      { to: "/timeslots", label: "Time slots", icon: <EventNoteIcon /> },
    );
  }
  navItems.push({ to: "/schedule", label: t("nav.schedule"), icon: <EventNoteIcon /> });

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {t("app_title")}
          </Typography>
          <Select
            size="small"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            sx={{ color: "inherit", ".MuiSvgIcon-root": { color: "inherit" } }}
          >
            <MenuItem value="ru">Русский</MenuItem>
            <MenuItem value="ky">Кыргызча</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </Select>
          <Typography variant="body2">
            {user?.username} ({user?.role})
          </Typography>
          <ListItemButton onClick={handleLogout} sx={{ width: "auto", borderRadius: 1 }}>
            {t("nav.logout")}
          </ListItemButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List>
          {navItems.map((item) => (
            <ListItemButton key={item.to} component={NavLink} to={item.to}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: `calc(100% - ${DRAWER_WIDTH}px)` }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

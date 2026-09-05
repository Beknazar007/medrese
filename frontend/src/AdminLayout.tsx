import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ApartmentIcon from "@mui/icons-material/Apartment";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventNoteIcon from "@mui/icons-material/EventNote";
import GroupsIcon from "@mui/icons-material/Groups";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PeopleIcon from "@mui/icons-material/People";
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import { type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const DRAWER_WIDTH = 230;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/** Reference-data administration (faculties/departments/subjects/groups/semesters/rooms/
 * time slots/admin accounts) that the redesigned Broadsheet screens don't cover — someone
 * still has to create this data before the dean/teacher flows have anything to work with. */
export default function AdminLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function backHref() {
    if (user?.role === "TEACHER") return "/teacher";
    if (user?.role === "DEAN") return "/dean/teachers";
    return "/rector";
  }

  const navItems: NavItem[] = [];
  if (user?.role === "RECTOR") {
    navItems.push({ to: "/admin/faculties", label: "Faculties", icon: <ApartmentIcon /> });
  }
  navItems.push({ to: "/admin/departments", label: "Departments", icon: <AccountTreeIcon /> });
  if (user?.role === "RECTOR") {
    navItems.push({ to: "/admin/users", label: "Admin accounts", icon: <AdminPanelSettingsIcon /> });
  }
  navItems.push(
    { to: "/admin/subjects", label: "Subjects", icon: <MenuBookIcon /> },
    { to: "/admin/groups", label: "Groups", icon: <GroupsIcon /> },
  );
  if (user?.role === "RECTOR") {
    navItems.push({ to: "/admin/teachers", label: "Teachers (all)", icon: <PeopleIcon /> });
  }
  if (user?.role === "RECTOR") {
    navItems.push(
      { to: "/admin/semesters", label: "Semesters", icon: <CalendarMonthIcon /> },
      { to: "/admin/rooms", label: "Rooms", icon: <MeetingRoomIcon /> },
      { to: "/admin/timeslots", label: "Time slots", icon: <EventNoteIcon /> },
    );
  }

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <ListItemButton component={NavLink} to={backHref()} sx={{ width: "auto", borderRadius: 1, color: "inherit" }}>
            <ArrowBackIcon fontSize="small" sx={{ mr: 1 }} /> Medrese
          </ListItemButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Settings
          </Typography>
          <Typography variant="body2">
            {user?.username} ({user?.role})
          </Typography>
          <ListItemButton onClick={handleLogout} sx={{ width: "auto", borderRadius: 1 }}>
            Log out
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

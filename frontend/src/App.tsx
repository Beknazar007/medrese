import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute, { roleHome } from "./RoleRoute";
import { useAuth } from "./context/AuthContext";

import TeacherAppPage from "./pages/teacher/TeacherAppPage";

import DeanTeachersPage from "./pages/dean/DeanTeachersPage";
import DeanAssignmentsPage from "./pages/dean/DeanAssignmentsPage";
import DeanSchedulePage from "./pages/dean/DeanSchedulePage";
import DeanLayout from "./pages/dean/DeanLayout";

import RectorDashboardPage from "./pages/rector/RectorDashboardPage";

import FacultiesPage from "./pages/FacultiesPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import UsersPage from "./pages/UsersPage";
import SubjectsPage from "./pages/SubjectsPage";
import GroupsPage from "./pages/GroupsPage";
import SemestersPage from "./pages/SemestersPage";
import RoomsPage from "./pages/RoomsPage";
import TimeSlotsPage from "./pages/TimeSlotsPage";
import TeachersPage from "./pages/TeachersPage";

import { theme } from "./theme";

const queryClient = new QueryClient();

function DefaultRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/teacher"
                element={
                  <ProtectedRoute>
                    <RoleRoute roles={["TEACHER"]}>
                      <TeacherAppPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />

              <Route
                element={
                  <ProtectedRoute>
                    <RoleRoute roles={["DEAN"]}>
                      <DeanLayout />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              >
                <Route path="/dean/teachers" element={<DeanTeachersPage />} />
                <Route path="/dean/assignments" element={<DeanAssignmentsPage />} />
                <Route path="/dean/schedule" element={<DeanSchedulePage />} />
              </Route>

              <Route
                path="/rector"
                element={
                  <ProtectedRoute>
                    <RoleRoute roles={["RECTOR"]}>
                      <RectorDashboardPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />

              <Route
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  path="/admin/faculties"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <FacultiesPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/departments"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <DepartmentsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <UsersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/teachers"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <TeachersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/subjects"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <SubjectsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/groups"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <GroupsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/semesters"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <SemestersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/rooms"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <RoomsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/timeslots"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <TimeSlotsPage />
                    </RoleRoute>
                  }
                />
              </Route>

              <Route path="*" element={<DefaultRedirect />} />
            </Routes>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

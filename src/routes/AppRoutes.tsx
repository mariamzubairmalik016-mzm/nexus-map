import { BrowserRouter, Route, Routes } from "react-router-dom";

import MainLayout from "../Layouts/MainLayout";
import Home from "../Pages/Home/Home";
import Explore from "../Pages/Explore/Explore";
import MapPage from "../Pages/Map/MapPage";
import Community from "../Pages/Community/Community";
import Login from "../Pages/Auth/Login";
import Signup from "../Pages/Auth/Signup";
import ForgotPassword from "../Pages/Auth/ForgotPassword";
import ResetPassword from "../Pages/Auth/ResetPassword";
import Dashboard from "../Pages/Dashboard/Dashboard";
import Profile from "../Pages/Profile/Profile";
import Favorites from "../Pages/Favorites/Favorites";
import History from "../Pages/History/History";
import Notifications from "../Pages/Notifications/Notifications";
import OfflineMaps from "../Pages/OfflineMaps/OfflineMaps";
import AIPlanner from "../Pages/AIPlanner/AIPlanner";
import Settings from "../Pages/Settings/Settings";
import AdminDashboard from "../Pages/Admin/AdminDashboard";
import NotFound from "../Pages/NotFound/NotFound";

import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/community" element={<Community />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/history" element={<History />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/offline-maps" element={<OfflineMaps />} />
          <Route path="/ai-planner" element={<AIPlanner />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;

/**
 * Wraps AdminRoutes in Routes so it can be mounted as the element for admin paths.
 * Only loaded when VITE_IS_PRODUCTION is not set (staging). Production never imports this.
 */
import { Routes } from "react-router-dom";
import { AdminRoutes } from "./AdminRoutes";

export default function AdminAppWrapper() {
  return (
    <Routes>
      <AdminRoutes />
    </Routes>
  );
}

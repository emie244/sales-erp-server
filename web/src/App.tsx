import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomerPage from './pages/CustomerPage';
import ProductPage from './pages/ProductPage';
import SalesOrderPage from './pages/SalesOrderPage';
import PrepaymentPage from './pages/PrepaymentPage';
import ApprovalPage from './pages/ApprovalPage';
import ReportPage from './pages/ReportPage';
import AdminPage from './pages/AdminPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  const role = localStorage.getItem('erp_role');
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="customers" element={<CustomerPage />} />
          <Route path="products" element={<ProductPage />} />
          <Route path="sales-orders" element={<SalesOrderPage />} />
          <Route path="prepayments" element={<PrepaymentPage />} />
          <Route path="approvals" element={<ApprovalPage />} />
          <Route path="reports" element={<ReportPage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

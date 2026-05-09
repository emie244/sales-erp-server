import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import './App.css';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomerPage from './pages/CustomerPage';
import ProductInventoryPage from './pages/ProductInventoryPage';
import SalesOrderPage from './pages/SalesOrderPage';
import PrepaymentPage from './pages/PrepaymentPage';
import ApprovalPage from './pages/ApprovalPage';
import ReportPage from './pages/ReportPage';
import SupplierPage from './pages/SupplierPage';
import AdminPage from './pages/AdminPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import ProductionOrderPage from './pages/ProductionOrderPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  const permissions = JSON.parse(localStorage.getItem('erp_permissions') || '[]');
  if (!token) return <Navigate to="/login" replace />;
  if (!permissions.includes('*') && !permissions.includes('admin:users')) {
    return <Navigate to="/dashboard" replace />;
  }
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
          <Route path="products" element={<ProductInventoryPage />} />
          <Route path="sales-orders" element={<SalesOrderPage />} />
          <Route path="prepayments" element={<PrepaymentPage />} />
          <Route path="approvals" element={<ApprovalPage />} />
          <Route path="reports" element={<ReportPage />} />
          <Route path="suppliers" element={<SupplierPage />} />
          <Route path="purchase-orders" element={<PurchaseOrderPage />} />
          <Route path="production-orders" element={<ProductionOrderPage />} />
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

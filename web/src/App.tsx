import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomerPage from './pages/CustomerPage';
import ProductPage from './pages/ProductPage';
import SalesOrderPage from './pages/SalesOrderPage';
import ApprovalPage from './pages/ApprovalPage';
import ReportPage from './pages/ReportPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
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
          <Route path="approvals" element={<ApprovalPage />} />
          <Route path="reports" element={<ReportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

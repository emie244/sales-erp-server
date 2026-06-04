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
import OperationLogPage from './pages/OperationLogPage';
import SyncLogPage from './pages/SyncLogPage';
import MaterialCategoryPage from './pages/MaterialCategoryPage';
import ProfilePage from './pages/ProfilePage';
import ProductDetailPage from './pages/ProductDetailPage';
import SalesOrderDetailPage from './pages/SalesOrderDetailPage';
import BomPage from './pages/BomPage';
import AgingReportPage from './pages/AgingReportPage';
import PurchaseRequestPage from './pages/PurchaseRequestPage';
import StockLedgerPage from './pages/StockLedgerPage';
import StockAlertPage from './pages/StockAlertPage';
import InvoicePage from './pages/InvoicePage';
import CustomerStatementPage from './pages/CustomerStatementPage';
import VoucherPage from './pages/VoucherPage';
import NotificationPage from './pages/NotificationPage';
import CategoryMappingPage from './pages/CategoryMappingPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  const permissions = JSON.parse(
    localStorage.getItem('erp_permissions') || '[]',
  ) as string[];
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
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="sales-orders" element={<SalesOrderPage />} />
          <Route path="sales-orders/:id" element={<SalesOrderDetailPage />} />
          <Route path="prepayments" element={<PrepaymentPage />} />
          <Route path="approvals" element={<ApprovalPage />} />
          <Route path="reports" element={<ReportPage />} />
          <Route path="aging-report" element={<AgingReportPage />} />
          <Route path="customer-statement" element={<CustomerStatementPage />} />
          <Route path="purchase-requests" element={<PurchaseRequestPage />} />
          <Route path="suppliers" element={<SupplierPage />} />
          <Route path="purchase-orders" element={<PurchaseOrderPage />} />
          <Route path="production-orders" element={<ProductionOrderPage />} />
          <Route path="boms" element={<BomPage />} />
          <Route path="stock-ledger" element={<StockLedgerPage />} />
          <Route path="stock-alerts" element={<StockAlertPage />} />
          <Route path="invoices" element={<InvoicePage />} />
          <Route path="vouchers" element={<VoucherPage />} />
          <Route
            path="material-categories"
            element={<MaterialCategoryPage />}
          />
          <Route
            path="operation-logs"
            element={
              <AdminRoute>
                <OperationLogPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/sync-logs"
            element={
              <AdminRoute>
                <SyncLogPage />
              </AdminRoute>
            }
          />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="category-mappings" element={<CategoryMappingPage />} />
          <Route path="profile" element={<ProfilePage />} />
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

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import '@/App.css';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import OrderSuccess from './pages/OrderSuccess';
import Referrals from './pages/Referrals';
import OrderTracking from './pages/OrderTracking';
import AdminDashboard from './pages/AdminDashboard';
import MerchantDashboard from './pages/MerchantDashboard';
import DriverDashboard from './pages/DriverDashboard';
import MerchantProfile from './pages/MerchantProfile';
import PaymentPage from './pages/PaymentPage';
import MyOrders from './pages/MyOrders';
import CustomerProfile from './pages/CustomerProfile';

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/order-success" element={<OrderSuccess />} />
      <Route path="/referrals" element={<Referrals />} />
      <Route path="/track/:orderId" element={<OrderTracking />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/merchant/dashboard" element={<MerchantDashboard />} />
      <Route path="/driver/dashboard" element={<DriverDashboard />} />
      <Route path="/merchant/profile" element={<MerchantProfile />} />
      <Route path="/payment" element={<PaymentPage />} />
      <Route path="/my-orders" element={<MyOrders />} />
      <Route path="/profile" element={<CustomerProfile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

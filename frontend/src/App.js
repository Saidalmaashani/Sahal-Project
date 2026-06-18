import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import PushPrompt from './components/PushPrompt';
import { AnimatePresence, motion } from 'framer-motion';
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
import StoreDetail from './pages/StoreDetail';
import MyOrders from './pages/MyOrders';
import CustomerProfile from './pages/CustomerProfile';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' } },
};

function PageWrapper({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Landing /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/shop" element={<PageWrapper><Shop /></PageWrapper>} />
        <Route path="/product/:id" element={<PageWrapper><ProductDetail /></PageWrapper>} />
        <Route path="/cart" element={<PageWrapper><Cart /></PageWrapper>} />
        <Route path="/order-success" element={<PageWrapper><OrderSuccess /></PageWrapper>} />
        <Route path="/referrals" element={<PageWrapper><Referrals /></PageWrapper>} />
        <Route path="/track/:orderId" element={<PageWrapper><OrderTracking /></PageWrapper>} />
        <Route path="/admin/dashboard" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
        <Route path="/merchant/dashboard" element={<PageWrapper><MerchantDashboard /></PageWrapper>} />
        <Route path="/driver/dashboard" element={<PageWrapper><DriverDashboard /></PageWrapper>} />
        <Route path="/merchant/profile" element={<PageWrapper><MerchantProfile /></PageWrapper>} />
        <Route path="/payment" element={<PageWrapper><PaymentPage /></PageWrapper>} />
        <Route path="/store/:storeId" element={<PageWrapper><StoreDetail /></PageWrapper>} />
        <Route path="/my-orders" element={<PageWrapper><MyOrders /></PageWrapper>} />
        <Route path="/profile" element={<PageWrapper><CustomerProfile /></PageWrapper>} />
        <Route path="/forgot-password" element={<PageWrapper><ForgotPassword /></PageWrapper>} />
        <Route path="/reset-password" element={<PageWrapper><ResetPassword /></PageWrapper>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
        <Toaster position="top-right" />
        <PushPrompt />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

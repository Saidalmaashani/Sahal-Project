import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/sonner';
import PushPrompt from './components/PushPrompt';
import { AnimatePresence, motion } from 'framer-motion';
import '@/App.css';

// Lazy-loaded pages → أصغر bundle مبدئي وتحميل أسرع
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Referrals = lazy(() => import('./pages/Referrals'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const MerchantProfile = lazy(() => import('./pages/MerchantProfile'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const StoreDetail = lazy(() => import('./pages/StoreDetail'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const DeliveryConfirmPage = lazy(() => import('./pages/DeliveryConfirmPage'));

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

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/wishlist" element={<PageWrapper><WishlistPage /></PageWrapper>} />
        <Route path="/confirm-delivery/:token" element={<DeliveryConfirmPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WishlistProvider>
          <BrowserRouter>
            <AnimatedRoutes />
            <Toaster position="top-right" />
            <PushPrompt />
          </BrowserRouter>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/common/PrivateRoute';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import VerifyPhone from './components/auth/VerifyPhone';

// Customer Components
import Home from './components/customer/Home';
import Services from './components/customer/Services';
import ServiceDetail from './components/customer/ServiceDetail';
import Checkout from './components/customer/Checkout';
import Dashboard from './components/customer/Dashboard';

// Provider Components
import ProviderDashboard from './components/provider/ProviderDashboard';
import ProviderRegistration from './components/provider/ProviderRegistration';

// Admin Components
import AdminDashboard from './components/admin/AdminDashboard';

// Common
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import LoadingSpinner from './components/common/LoadingSpinner';

import './styles/globals.css';

function App() {
    return (
        <Router>
            <AuthProvider>
                <div className="app">
                    <Header />
                    <main className="main-content">
                        <Routes>
                            {/* Public Routes */}
                            <Route path="/" element={<Home />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/verify" element={<VerifyPhone />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/services/:id" element={<ServiceDetail />} />
                            
                            {/* Customer Routes */}
                            <Route element={<PrivateRoute allowedRoles={['customer']} />}>
                                <Route path="/checkout" element={<Checkout />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                            </Route>
                            
                            {/* Provider Routes */}
                            <Route element={<PrivateRoute allowedRoles={['provider', 'admin']} />}>
                                <Route path="/provider/register" element={<ProviderRegistration />} />
                                <Route path="/provider/dashboard" element={<ProviderDashboard />} />
                            </Route>
                            
                            {/* Admin Routes */}
                            <Route element={<PrivateRoute allowedRoles={['admin']} />}>
                                <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
                            </Route>
                            
                            {/* 404 */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </main>
                    <Footer />
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;

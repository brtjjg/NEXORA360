import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await login(email, password);
            
            if (result.success) {
                const redirectPath = result.dashboardRoute || 
                                   (result.user.role === 'admin' ? '/admin/dashboard' :
                                    result.user.role === 'provider' ? '/provider/dashboard' :
                                    '/dashboard');
                navigate(redirectPath, { replace: true });
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const fillDemoCredentials = (role) => {
        const credentials = {
            admin: { email: 'admin@nexora.com', password: 'Admin@2026!' },
            provider: { email: 'provider@nexora.com', password: 'Provider@2026!' },
            customer: { email: 'customer@nexora.com', password: 'Customer@2026!' }
        };
        const creds = credentials[role];
        if (creds) {
            setEmail(creds.email);
            setPassword(creds.password);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-left">
                    <div className="login-brand">
                        <h1>NEXORA</h1>
                    </div>
                    <div className="login-welcome">
                        <h2>Welcome Back</h2>
                        <p>Access your digital services, orders and projects in one place.</p>
                    </div>
                    <div className="login-icons">
                        <span>💻</span>
                        <span>🎨</span>
                        <span>🤖</span>
                        <span>📱</span>
                    </div>
                </div>

                <div className="login-right">
                    <div className="login-card">
                        <h2>Login to NEXORA</h2>
                        
                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Email or Phone</label>
                                <input
                                    type="text"
                                    placeholder="Enter your email or phone"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Password</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                            </div>

                            <div className="form-options">
                                <label className="checkbox-label">
                                    <input type="checkbox" defaultChecked />
                                    Remember me
                                </label>
                                <Link to="/forgot-password" className="forgot-link">
                                    Forgot password?
                                </Link>
                            </div>

                            <button 
                                type="submit" 
                                className="btn-primary btn-full"
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : '🔵 Login'}
                            </button>

                            <p className="register-link">
                                Don't have an account? <Link to="/register">Create Account</Link>
                            </p>
                        </form>

                        <div className="test-accounts">
                            <p className="test-label">Quick Test Accounts:</p>
                            <div className="test-buttons">
                                <button 
                                    className="test-btn admin"
                                    onClick={() => fillDemoCredentials('admin')}
                                >
                                    👑 Admin
                                </button>
                                <button 
                                    className="test-btn provider"
                                    onClick={() => fillDemoCredentials('provider')}
                                >
                                    💼 Provider
                                </button>
                                <button 
                                    className="test-btn customer"
                                    onClick={() => fillDemoCredentials('customer')}
                                >
                                    🧑 Customer
                                </button>
                            </div>
                            <small className="test-note">
                                Password for all: <strong>Admin@2026!</strong>
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;

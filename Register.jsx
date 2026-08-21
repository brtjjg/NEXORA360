// frontend/src/components/auth/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Register = () => {
    const [step, setStep] = useState(1);
    const [accountType, setAccountType] = useState(null);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        terms: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleAccountTypeSelect = (type) => {
        setAccountType(type);
        setStep(2);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (!formData.terms) {
            setError('Please agree to the Terms & Conditions');
            setLoading(false);
            return;
        }

        try {
            const result = await register({
                ...formData,
                role: accountType === 'provider' ? 'provider' : 'customer'
            });

            if (result.success) {
                navigate('/verify', { 
                    state: { email: formData.email, phone: formData.phone } 
                });
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page">
            <div className="register-container">
                <h1>Create Your Account</h1>
                <p className="register-subtitle">Join the digital services marketplace.</p>

                {step === 1 && (
                    <>
                        <h3>Choose account type</h3>
                        <div className="account-type-grid">
                            <div 
                                className={`account-type-card ${accountType === 'customer' ? 'selected' : ''}`}
                                onClick={() => handleAccountTypeSelect('customer')}
                            >
                                <div className="account-type-icon">🧑</div>
                                <h4>Customer</h4>
                                <p>I want to purchase digital services.</p>
                            </div>
                            <div 
                                className={`account-type-card ${accountType === 'provider' ? 'selected' : ''}`}
                                onClick={() => handleAccountTypeSelect('provider')}
                            >
                                <div className="account-type-icon">💼</div>
                                <h4>Service Provider</h4>
                                <p>I want to sell my digital services.</p>
                            </div>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <form className="register-form" onSubmit={handleSubmit}>
                        {error && (
                            <div className="alert alert-error">{error}</div>
                        )}

                        <div className="form-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                name="fullName"
                                placeholder="Enter your full name"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                placeholder="Enter your phone number"
                                value={formData.phone}
                                onChange={handleChange}

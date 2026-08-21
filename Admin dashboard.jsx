import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

// Dashboard Overview
const DashboardOverview = () => {
    const [stats, setStats] = useState({
        revenue: 0,
        orders: 0,
        customers: 0,
        providers: 0,
        pendingOrders: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await axios.get('/admin/stats');
                setStats(response.data);
                setRecentOrders(response.data.recentOrders || []);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="loading-spinner">Loading...</div>;

    return (
        <div className="admin-overview">
            <h2>Dashboard Overview</h2>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">💰</div>
                    <div className="stat-info">
                        <h3>Revenue</h3>
                        <p className="stat-value">KSh {stats.revenue.toLocaleString()}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📦</div>
                    <div className="stat-info">
                        <h3>Total Orders</h3>
                        <p className="stat-value">{stats.orders}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-info">
                        <h3>Customers</h3>
                        <p className="stat-value">{stats.customers}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🧑‍💻</div>
                    <div className="stat-info">
                        <h3>Providers</h3>
                        <p className="stat-value">{stats.providers}</p>
                    </div>
                </div>
            </div>

            {recentOrders.length > 0 && (
                <div className="recent-orders">
                    <h3>Recent Orders</h3>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Service</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentOrders.map(order => (
                                <tr key={order.id}>
                                    <td>#{order.id.slice(0, 8)}</td>
                                    <td>{order.customer_name || 'N/A'}</td>
                                    <td>{order.service_name || 'N/A'}</td>
                                    <td>KSh {order.total_amount_kes?.toLocaleString() || 0}</td>
                                    <td>
                                        <span className={`status-badge ${order.status}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// Users Management
const UsersManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get('/admin/users');
                setUsers(response.data);
            } catch (error) {
                console.error('Failed to fetch users:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const updateUserStatus = async (userId, isActive) => {
        try {
            await axios.patch(`/admin/users/${userId}`, { isActive });
            setUsers(users.map(u => 
                u.id === userId ? { ...u, is_active: isActive } : u
            ));
        } catch (error) {
            console.error('Failed to update user:', error);
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;

    return (
        <div className="users-management">
            <h2>Users Management</h2>
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>{user.full_name}</td>
                            <td>{user.email}</td>
                            <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                            <td>
                                <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                    {user.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <button 
                                    className="btn-sm btn-primary"
                                    onClick={() => updateUserStatus(user.id, !user.is_active)}
                                >
                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Main Admin Dashboard
const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { path: '', label: '📊 Dashboard' },
        { path: 'users', label: '👥 Users' },
        { path: 'providers', label: '🧑‍💻 Providers' },
        { path: 'services', label: '🛍️ Services' },
        { path: 'orders', label: '📦 Orders' },
        { path: 'payments', label: '💳 Payments' },
        { path: 'commissions', label: '💰 Commissions' },
        { path: 'reviews', label: '⭐ Reviews' },
        { path: 'disputes', label: '⚠️ Disputes' },
        { path: 'promotions', label: '🎟️ Promotions' },
        { path: 'notifications', label: '📣 Notifications' },
        { path: 'analytics',

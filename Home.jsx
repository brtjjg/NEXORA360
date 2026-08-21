import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const Home = () => {
    const [categories, setCategories] = useState([]);
    const [featuredServices, setFeaturedServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch categories
                const categoriesRes = await axios.get('/services/categories');
                setCategories(categoriesRes.data);

                // Fetch featured services
                const servicesRes = await axios.get('/services/featured');
                setFeaturedServices(servicesRes.data);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const categoryColors = {
        'Website & Development': '#2563EB',
        'Graphic Design': '#8B5CF6',
        'AI & Automation': '#06B6D4',
        'Social Media': '#EC4899',
        'Virtual Assistance': '#16A34A',
        'Writing & Content': '#F59E0B',
        'Publishing': '#DC2626',
        'E-commerce': '#FCD34D',
        'Digital Marketing': '#EC4899',
        'Software & Systems': '#6366F1'
    };

    const categoryIcons = {
        'Website & Development': '💻',
        'Graphic Design': '🎨',
        'AI & Automation': '🤖',
        'Social Media': '📱',
        'Virtual Assistance': '🧑‍💻',
        'Writing & Content': '✍️',
        'Publishing': '📚',
        'E-commerce': '🛒',
        'Digital Marketing': '📣',
        'Software & Systems': '⚙️'
    };

    if (loading) {
        return <div className="loading-spinner">Loading...</div>;
    }

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Everything Digital.<br />
                        <span className="highlight-blue">One Marketplace.</span>
                    </h1>
                    <p className="hero-subtitle">
                        Build. Create. Automate. Market. Grow.
                    </p>
                    <div className="hero-actions">
                        <button 
                            className="btn-primary btn-large"
                            onClick={() => navigate('/services')}
                        >
                            🔵 Explore Services
                        </button>
                        <button 
                            className="btn-secondary btn-large"
                            onClick={() => navigate('/provider/register')}
                        >
                            ⚪ Become a Provider
                        </button>
                    </div>
                    <div className="hero-trust-badges">
                        <span>✓ Trusted Digital Services</span>
                        <span>🔒 Secure Payments</span>
                        <span>🚀 Fast Delivery</span>
                    </div>
                </div>
            </section>

            {/* Categories Section */}
            <section className="categories-section">
                <div className="section-header">
                    <h2>Explore Categories</h2>
                    <button className="view-all" onClick={() => navigate('/services')}>
                        View All →
                    </button>
                </div>
                <div className="categories-grid">
                    {categories.map((category, index) => (
                        <div 
                            key={index}
                            className="category-card"
                            style={{ 
                                borderColor: categoryColors[category] || '#2563EB',
                                '--hover-color': categoryColors[category] || '#2563EB'
                            }}
                            onClick={() => navigate(`/services?category=${encodeURIComponent(category)}`)}
                        >
                            <div 
                                className="category-icon" 
                                style={{ 
                                    background: `${categoryColors[category] || '#2563EB'}15`,
                                    color: categoryColors[category] || '#2563EB'
                                }}
                            >
                                {categoryIcons[category] || '📦'}
                            </div>
                            <h3 className="category-name">{category}</h3>
                            <span className="category-arrow">→</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Featured Services */}
            <section className="featured-section">
                <div className="section-header">
                    <h2>🔥 Popular Services</h2>
                    <button className="view-all" onClick={() => navigate('/services')}>
                        View All →
                    </button>
                </div>
                <div className="services-grid">
                    {featuredServices.map((service) => (
                        <div 
                            key={service.id}
                            className="service-card"
                            onClick={() => navigate(`/services/${service.id}`)}
                        >
                            <div className="service-header">
                                <span className="service-category">{service.category}</span>
                                <span className="service-rating">⭐ {service.rating || 4.5}</span>
                            </div>
                            <h3 className="service-name">{service.name}</h3>
                            <p className="service-description">{service.description}</p>
                            <div className="service-footer">
                                <span className="service-price">
                                    From KSh {service.starting_price_kes.toLocaleString()}
                                </span>
                                <button className="btn-sm btn-primary">View →</button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Home;

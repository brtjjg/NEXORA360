const { pool } = require('../config/database');

const seedServices = async () => {
    try {
        // Get provider ID
        const providerQuery = 'SELECT id FROM users WHERE email = $1';
        const providerResult = await pool.query(providerQuery, ['provider@nexora.com']);
        
        if (providerResult.rows.length === 0) {
            console.log('❌ Provider not found. Please run initDb first.');
            return;
        }

        const providerId = providerResult.rows[0].id;

        const services = [
            {
                name: 'Business Website',
                description: 'Professional business website with all essential features',
                category: 'Website & Development',
                starting_price_kes: 12000,
                starting_price_usd: 99,
                delivery_days: 5
            },
            {
                name: 'Logo Design',
                description: 'Custom logo design for your brand identity',
                category: 'Graphic Design',
                starting_price_kes: 1500,
                starting_price_usd: 12,
                delivery_days: 2
            },
            {
                name: 'AI Chatbot',
                description: 'Intelligent chatbot for customer support',
                category: 'AI & Automation',
                starting_price_kes: 10000,
                starting_price_usd: 82,
                delivery_days: 7
            },
            {
                name: 'Social Media Management',
                description: 'Complete social media presence management',
                category: 'Social Media',
                starting_price_kes: 5000,
                starting_price_usd: 41,
                delivery_days: 1
            },
            {
                name: 'Virtual Assistant',
                description: 'Professional virtual assistance for your business',
                category: 'Virtual Assistance',
                starting_price_kes: 500,
                starting_price_usd: 4,
                delivery_days: 1
            },
            {
                name: 'Article Writing',
                description: 'High-quality articles for your blog or website',
                category: 'Writing & Content',
                starting_price_kes: 1000,
                starting_price_usd: 8,
                delivery_days: 3
            },
            {
                name: 'E-book Formatting',
                description: 'Professional e-book formatting for publishing',
                category: 'Publishing',
                starting_price_kes: 2500,
                starting_price_usd: 20,
                delivery_days: 4
            },
            {
                name: 'Online Store Setup',
                description: 'Complete e-commerce store setup',
                category: 'E-commerce',
                starting_price_kes: 10000,
                starting_price_usd: 82,
                delivery_days: 10
            },
            {
                name: 'Digital Marketing Campaign',
                description: 'Comprehensive digital marketing campaign',
                category: 'Digital Marketing',
                starting_price_kes: 5000,
                starting_price_usd: 41,
                delivery_days: 3
            }
        ];

        for (const service of services) {
            const checkQuery = 'SELECT * FROM services WHERE name = $1 AND provider_id = $2';
            const checkResult = await pool.query(checkQuery, [service.name, providerId]);

            if (checkResult.rows.length === 0) {
                const query = `
                    INSERT INTO services (
                        provider_id, name, description, category, 
                        starting_price_kes, starting_price_usd, delivery_days
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                `;
                const result = await pool.query(query, [
                    providerId,
                    service.name,
                    service.description,
                    service.category,
                    service.starting_price_kes,
                    service.starting_price_usd,
                    service.delivery_days
                ]);

                // Add packages for each service
                const serviceId = result.rows[0].id;
                await addPackages(serviceId, service.name);
                console.log(`✅ Service created: ${service.name}`);
            }
        }

        console.log('✅ Services seeded successfully');
    } catch (error) {
        console.error('❌ Failed to seed services:', error.message);
    }
};

const addPackages = async (serviceId, serviceName) => {
    const packages = {
        'Business Website': [
            { name: 'Starter', price_kes: 12000, price_usd: 99, features: ['3 pages', 'Mobile responsive', 'Contact form'] },
            { name: 'Business', price_kes: 20000, price_usd: 165, features: ['5 pages', 'WhatsApp integration', 'SEO basics'], recommended: true },
            { name: 'Premium', price_kes: 35000, price_usd: 290, features: ['Full custom', 'Database', 'Payment integration'] }
        ],
        'Logo Design': [
            { name: 'Starter', price_kes: 1500, price_usd: 12, features: ['1 concept', '2 revisions', 'High resolution'] },
            { name: 'Business', price_kes: 3000, price_usd: 25, features: ['3 concepts', '5 revisions', 'Source file'], recommended: true },
            { name: 'Premium', price_kes: 5000, price_usd: 41, features: ['5 concepts', 'Unlimited revisions', 'Brand guidelines'] }
        ],
        'AI Chatbot': [
            { name: 'Starter', price_kes: 10000, price_usd: 82, features: ['Basic responses', '5 FAQs', 'Email integration'] },
            { name: 'Business', price_kes: 20000, price_usd: 165, features: ['Advanced responses', '20 FAQs', 'WhatsApp'], recommended: true },
            { name: 'Premium', price_kes: 40000, price_usd: 330, features: ['Custom AI', 'Unlimited FAQs', 'Multi-channel'] }
        ]
    };

    const servicePackages = packages[serviceName] || [
        { name: 'Starter', price_kes: 5000, price_usd: 41, features: ['Basic features'] },
        { name: 'Business', price_kes: 10000, price_usd: 82, features: ['Advanced features'], recommended: true },
        { name: 'Premium', price_kes: 20000, price_usd: 165, features: ['Premium features'] }
    ];

    for (const pkg of servicePackages) {
        await pool.query(
            `INSERT INTO packages (service_id, name, price_kes, price_usd, features, is_recommended)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [serviceId, pkg.name, pkg.price_kes, pkg.price_usd, pkg.features, pkg.recommended || false]
        );
    }
};

module.exports = { seedServices };

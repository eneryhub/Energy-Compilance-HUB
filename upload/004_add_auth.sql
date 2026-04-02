-- Tabla de empresas (para suscripciones)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(50) UNIQUE,
    email VARCHAR(200) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    subscription_plan VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
    subscription_expires_at TIMESTAMP,
    max_users INTEGER DEFAULT 5,
    max_permits_month INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(50) DEFAULT 'technician', -- admin, supervisor, technician
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, company_id)
);

-- Tabla de sesiones (para refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de auditoría de permisos (para tracking)
CREATE TABLE IF NOT EXISTS permit_audit (
    id SERIAL PRIMARY KEY,
    permit_id INTEGER REFERENCES permits(id),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50), -- CREATE, APPROVE, REJECT, VIEW
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar empresa demo
INSERT INTO companies (name, tax_id, email, subscription_plan, max_users, max_permits_month) 
VALUES ('Energy Solutions Demo', '123456789', 'demo@energy.com', 'pro', 20, 1000)
ON CONFLICT (email) DO NOTHING;

-- Insertar usuarios demo
INSERT INTO users (company_id, email, password_hash, full_name, role) 
VALUES (
    (SELECT id FROM companies WHERE email = 'demo@energy.com'),
    'admin@energy.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrkJqKZqYjYxqZqYjYxqZqYjYxqZqYjY', -- password: admin123
    'Administrador',
    'admin'
) ON CONFLICT DO NOTHING;

INSERT INTO users (company_id, email, password_hash, full_name, role) 
VALUES (
    (SELECT id FROM companies WHERE email = 'demo@energy.com'),
    'supervisor@energy.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrkJqKZqYjYxqZqYjYxqZqYjYxqZqYjY', -- password: admin123
    'Supervisor Principal',
    'supervisor'
) ON CONFLICT DO NOTHING;

INSERT INTO users (company_id, email, password_hash, full_name, role) 
VALUES (
    (SELECT id FROM companies WHERE email = 'demo@energy.com'),
    'tecnico@energy.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrkJqKZqYjYxqZqYjYxqZqYjYxqZqYjY', -- password: admin123
    'Técnico de Campo',
    'technician'
) ON CONFLICT DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_permits_company ON permits(company_id);
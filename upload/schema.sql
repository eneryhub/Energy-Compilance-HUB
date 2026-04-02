-- Esquema con versionamiento de formularios
CREATE DATABASE energy_compliance;

\c energy_compliance;

-- Tabla de versiones de formularios (auditoría y compliance)
CREATE TABLE form_versions (
    id SERIAL PRIMARY KEY,
    version_number VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT false,
    metadata JSONB,
    created_by VARCHAR(100)
);

-- Tabla de riesgos y reglas de seguridad
CREATE TABLE safety_rules (
    id SERIAL PRIMARY KEY,
    risk_type VARCHAR(50) NOT NULL, -- 'ALTURA', 'ELECTRICO', 'CONFINADO', 'CALIENTE'
    rule_name VARCHAR(100) NOT NULL,
    is_critical BOOLEAN DEFAULT false,
    ppe_required JSONB, -- Lista de EPP requeridos
    validation_rules JSONB,
    version_id INTEGER REFERENCES form_versions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla principal de permisos
CREATE TABLE permits (
    id SERIAL PRIMARY KEY,
    permit_number VARCHAR(50) UNIQUE NOT NULL,
    risk_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'APPROVED', 'REJECTED', 'PENDING'
    safety_check JSONB, -- Respuestas de checklist de seguridad
    metadata JSONB,
    technician_name VARCHAR(100),
    supervisor_name VARCHAR(100),
    work_location TEXT,
    work_description TEXT,
    rejection_reason TEXT,
    version_id INTEGER REFERENCES form_versions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP
);

-- Tabla de incidentes/dashboard analytics
CREATE TABLE safety_analytics (
    id SERIAL PRIMARY KEY,
    date DATE DEFAULT CURRENT_DATE,
    total_permits INTEGER DEFAULT 0,
    approved_permits INTEGER DEFAULT 0,
    rejected_permits INTEGER DEFAULT 0,
    rejected_by_risk JSONB, -- { "ALTURA": 5, "ELECTRICO": 2 }
    critical_failures INTEGER DEFAULT 0
);

-- Insertar versión inicial
INSERT INTO form_versions (version_number, effective_date, is_active, metadata) 
VALUES ('v1.0.0', '2024-01-01', true, '{"normative": "OSHA/ISO 45001", "region": "LATAM"}');

-- Insertar reglas de seguridad
INSERT INTO safety_rules (risk_type, rule_name, is_critical, ppe_required, validation_rules, version_id) VALUES
('ALTURA', 'Uso de arnés de seguridad', true, '["arnés", "línea de vida", "casco"]', '{"required": true, "field": "has_harness"}', 1),
('ALTURA', 'Punto de anclaje certificado', true, '[]', '{"required": true, "field": "has_anchor_point"}', 1),
('ELECTRICO', 'Equipo de protección dieléctrica', true, '["guantes dieléctricos", "botes dieléctricos", "casco clase E"]', '{"required": true, "field": "has_dielectric_ppe"}', 1),
('ELECTRICO', 'Prueba de ausencia de tensión', true, '[]', '{"required": true, "field": "voltage_test_performed"}', 1),
('CONFINADO', 'Monitoreo de atmósfera', true, '["detector de gases", "arnés de rescate", "trípode"]', '{"required": true, "field": "atmosphere_monitored"}', 1),
('CONFINADO', 'Permiso de entrada vigente', true, '[]', '{"required": true, "field": "has_entry_permit"}', 1),
('CALIENTE', 'Equipo de protección contra calor', false, '["careta soldador", "guantes de cuero", "manta ignífuga"]', '{"required": false}', 1),
('CALIENTE', 'Extintor disponible', true, '[]', '{"required": true, "field": "has_fire_extinguisher"}', 1);

-- Función para actualizar analytics automáticamente
CREATE OR REPLACE FUNCTION update_safety_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert daily analytics
    INSERT INTO safety_analytics (date, total_permits, approved_permits, rejected_permits)
    VALUES (CURRENT_DATE, 1, 
            CASE WHEN NEW.status = 'APPROVED' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'REJECTED' THEN 1 ELSE 0 END)
    ON CONFLICT (date) DO UPDATE
    SET total_permits = safety_analytics.total_permits + 1,
        approved_permits = safety_analytics.approved_permits + 
            CASE WHEN NEW.status = 'APPROVED' THEN 1 ELSE 0 END,
        rejected_permits = safety_analytics.rejected_permits + 
            CASE WHEN NEW.status = 'REJECTED' THEN 1 ELSE 0 END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analytics
AFTER INSERT ON permits
FOR EACH ROW
EXECUTE FUNCTION update_safety_analytics();
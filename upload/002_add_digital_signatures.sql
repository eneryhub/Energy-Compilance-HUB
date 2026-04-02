-- database/migrations/002_add_digital_signatures.sql

-- Tabla de firmas digitales
CREATE TABLE digital_signatures (
    id SERIAL PRIMARY KEY,
    permit_id INTEGER REFERENCES permits(id) ON DELETE CASCADE,
    signer_type VARCHAR(20) NOT NULL, -- 'TECHNICIAN', 'SUPERVISOR'
    signer_name VARCHAR(100) NOT NULL,
    signature_data TEXT NOT NULL, -- Base64 de la firma
    signature_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 de la firma para integridad
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    accuracy_meters DECIMAL(10, 2),
    device_info JSONB, -- Modelo, OS, browser
    ip_address INET,
    certificate_hash VARCHAR(64) -- Hash de certificado digital si aplica
);

-- Tabla de geolocalización de trabajos
CREATE TABLE work_locations (
    id SERIAL PRIMARY KEY,
    permit_id INTEGER REFERENCES permits(id),
    work_site VARCHAR(200),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    radius_meters INTEGER DEFAULT 50,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verification_method VARCHAR(50) -- 'GPS', 'QR_CODE', 'BEACON'
);

-- Índices para consultas de geocerca
CREATE INDEX idx_signatures_permit ON digital_signatures(permit_id);
CREATE INDEX idx_locations_coords ON work_locations(latitude, longitude);
CREATE INDEX idx_permit_status_geo ON permits(status, created_at) 
    WHERE status IN ('APPROVED', 'REJECTED');

-- Trigger para verificar geocerca
CREATE OR REPLACE FUNCTION verify_work_geofence()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar si la firma se realizó dentro del radio permitido
    IF EXISTS (
        SELECT 1 FROM work_locations wl
        WHERE wl.permit_id = NEW.permit_id
        AND (6371000 * acos(
            cos(radians(wl.latitude)) * cos(radians(NEW.latitude)) *
            cos(radians(NEW.longitude) - radians(wl.longitude)) +
            sin(radians(wl.latitude)) * sin(radians(NEW.latitude))
        )) <= wl.radius_meters
    ) THEN
        RETURN NEW;
    ELSE
        RAISE EXCEPTION 'Firma fuera del área de trabajo autorizada';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_verify_geofence
    BEFORE INSERT ON digital_signatures
    FOR EACH ROW
    EXECUTE FUNCTION verify_work_geofence();
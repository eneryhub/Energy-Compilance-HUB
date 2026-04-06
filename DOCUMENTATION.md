# Energy-Compliance Hub — Manual Tecnico Maestro

> Plataforma SaaS de gestion HSE (Health, Safety & Environment) y permisos de trabajo para la industria energetica.
> Stack: Next.js 16 + TypeScript + Prisma ORM (SQLite) + Tailwind CSS 4 + shadcn/ui

---

## Tabla de Contenidos

1. [Arquitectura del Sistema](#1-arquitectura-del-sistema)
2. [Arquitectura de IA Predictiva](#2-arquitectura-de-ia-predictiva)
3. [Guia de Conexion SCADA](#3-guia-de-conexion-scada)
4. [Circuito de Cumplimiento HSE](#4-circuito-de-cumplimiento-hse)
5. [Administracion Global (Super Admin)](#5-administracion-global-super-admin)
6. [Auditoria de Seguridad Multi-Tenancy](#6-auditoria-de-seguridad-multi-tenancy)
7. [Sistema de Suscripciones y Pagos](#7-sistema-de-suscripciones-y-pagos)
8. [Referencia de API](#8-referencia-de-api)
9. [Credenciales de Demostracion](#9-credenciales-de-demostracion)
10. [Variables de Entorno](#10-variables-de-entorno)

---

## 1. Arquitectura del Sistema

### 1.1 Vision General

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (Navegador)                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Landing   │  │ Login/Register│  │  App Shell (SPA)      │ │
│  │ Page      │  │ + "Volver    │  │  ┌─ Dashboard          │ │
│  │           │  │  a Inicio"   │  │  ├─ Permisos           │ │
│  │           │  │  (boton      │  │  ├─ Documentos HSE     │ │
│  │           │  │  de escape)  │  │  ├─ Aprobaciones       │ │
│  │           │  │              │  │  ├─ SCADA Telemetria   │ │
│  │           │  │              │  │  ├─ IA Predictiva      │ │
│  │           │  │              │  │  ├─ Suscripcion        │ │
│  │           │  │              │  │  ├─ Auditoria          │ │
│  │           │  │              │  │  └─ Admin Portal HQ    │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ JWT (localStorage) + fetch()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  API ROUTES (Next.js)                        │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ /auth/*   │  │ /permits/*   │  │  /sensors/*           │ │
│  │ login     │  │ create, list │  │  CRUD + telemetria    │ │
│  │ register  │  │ approve      │  │  simulation           │ │
│  └──────────┘  │ reject       │  │  site-safe            │ │
│  ┌──────────┐  └──────────────┘  └────────────────────────┘ │
│  │ /admin/*  │  ┌──────────────┐  ┌────────────────────────┐ │
│  │ activate  │  │ /predictive/ │  │  /subscription/*       │ │
│  │ companies │  │ insights     │  │  status, webhook       │ │
│  │ audit     │  │ (DeepSeek)   │  │  Stripe checkout      │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│                                                               │
│  CAPAS DE SEGURIDAD POR RUTA:                               │
│  [1] Autenticacion JWT (getSession)                          │
│  [2] Autorizacion RBAC (role check)                          │
│  [3] Suscripcion activa (checkSubscription)                  │
│  [4] Cumplimiento HSE (enforceCompliance)                    │
│  [5] Geocerca GPS (checkGeofence)                            │
│  [6] Aislamiento multi-tenancy (companyId from JWT)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ Prisma Client
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLite (Prisma ORM)                       │
│  Company, User, Permit, WorkLocation, Sensor,               │
│  SensorReading, HseDocument, AuditLog, Signature,          │
│  RiskTypeConfig, ChecklistItemConfig, SubscriptionInvoice   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Autenticacion

- **Metodo**: JWT stateless (library `jose`, algoritmo HS256)
- **Duracion token**: 30 dias
- **Payload del token**: `userId`, `companyId`, `role`, `email`, `name`
- **Storage**: `localStorage` en el cliente
- **Verificacion**: Cada API route llama a `getSession(req)` o `getTokenPayload(req)` que lee el header `Authorization: Bearer <token>`
- **Logout**: Client-side unicamente (remover token de localStorage)

### 1.3 Roles (RBAC)

| Rol | Permisos |
|-----|----------|
| `SUPER_ADMIN` | Control total de la plataforma. Acceso a `/admin-portal-hq`. Activar Enterprise |
| `ADMIN` | CRUD completo de la empresa: usuarios, documentos, sensores, suscripcion, auditoria |
| `SUPERVISOR` / `MANAGER` | Aprobar/rechazar permisos, crear sensores, acceso SCADA, simulacion |
| `TECHNICIAN` | Crear permisos, ver SCADA, ver telemetria |

### 1.4 Navegacion y "Boton de Escape"

Todas las paginas de autenticacion (`LoginForm` y `RegisterForm`) incluyen:

1. **Boton "Volver a Inicio"** — enlace visible en la parte superior con flecha izquierda que retorna al Landing Page
2. **Logo clickeable** — el logo en el encabezado es un boton interactivo que tambien navega al inicio
3. Ambos implementados via callback `onBackToHome()` pasado desde `page.tsx`

---

## 2. Arquitectura de IA Predictiva

### 2.1 Flujo de Datos

```
SensorReading (DB) ──► API /predictive/insights ──► DeepSeek AI (o Fallback)
                                                            │
                              ┌─────────────────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │  Cache (5 min)       │
                    │  Map<companyId,      │
                    │  {data, timestamp}>  │
                    └─────────┬───────────┘
                              │
                              ▼
                    PredictiveResponse {
                      overallRisk: LOW|MEDIUM|HIGH|CRITICAL
                      summary: string
                      sensors: [{
                        sensorId, sensorName, type,
                        currentValue, unit, trend,
                        failureProbability: 0-100,
                        maintenanceDays: number,
                        recommendation: string
                      }]
                    }
```

### 2.2 Motor de Prediccion

#### Modo IA (DeepSeek)

1. El endpoint `GET /api/predictive/insights` obtiene todos los sensores activos con sus ultimos 100 `SensorReading`
2. Construye un prompt estructurado con los datos de telemetria de cada sensor:
   - Tipo, valor actual, umbrales warning/critical
   - Historial de valores y estados
3. Envio a DeepSeek Chat API (`deepseek-chat` model):
   ```
   System Prompt: "Eres un experto en mantenimiento industrial predictivo..."
   Response Format: JSON con { overallRisk, summary, sensors[] }
   Temperature: 0.3 (respuestas consistentes)
   ```
4. La respuesta JSON se valida estructuralmente y se clampean los valores

#### Modo Fallback (sin API Key)

Si `DEEPSEEK_API_KEY` no esta configurada, se usa un motor de calculo heuristico:

```
failureProbability = base(5)
  + ratio_vs_warning (>80% = 35, >90% = 55, >100% = 75)
  + ratio_vs_critical (>70% = 60, >85% = 80, >95% = 95)
  + trend_modifier (rising = +15, falling = -10)
  → clamp(0, 100)

maintenanceDays:
  prob < 25% → 90 dias
  prob < 50% → 45 dias
  prob < 75% → 14 dias
  prob < 90% → 5 dias
  prob ≥ 90% → 1 dia
  si trend = rising → days * 0.7

overallRisk:
  avgRisk < 25 → LOW
  avgRisk < 50 → MEDIUM
  avgRisk < 70 → HIGH
  avgRisk ≥ 70 → CRITICAL
```

#### Calculo de Tendencia

```
trend = compare(promedio_primera_mitad, promedio_segunda_mitad)
  |change| < 3% → "stable"
  change > 0 → "rising"
  change < 0 → "falling"
```

### 2.3 Configuracion de IA

| Variable de Entorno | Descripcion | Requerida |
|---|---|---|
| `DEEPSEEK_API_KEY` | API key de DeepSeek | No (usa fallback) |
| `DEEPSEEK_API_URL` | URL base de la API | No (default: https://api.deepseek.com/v1) |

### 2.4 Cache

- In-memory `Map` con TTL de 5 minutos por `companyId`
- Evita llamadas repetidas a la API de IA
- Se reinicia con cada deploy/restart del servidor

---

## 3. Guia de Conexion SCADA

### 3.1 Arquitectura Dual

El sistema opera en dos modos:

```
┌─────────────────────────────────────────────┐
│            MODO DEMO (Default)              │
│  ┌──────────────────────────────────────┐   │
│  │ Motor de Simulacion (Brownian Motion)│   │
│  │  - Movimiento aleatorio con          │   │
│  │    reversión a la media              │   │
│  │  - Spikes ocasionales (3-5%)        │   │
│  │  - Suavizado: 70% prev + 30% new    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           MODO REAL (Produccion)            │
│  ┌──────────────────────────────────────┐   │
│  │ Webhook Receiver / MQTT Subscriber   │   │
│  │  - ingestSensorData(sensorId, value) │   │
│  │  - Almacena en DB + actualiza sensor │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 3.2 Tipos de Sensores Soportados

| Tipo | Unidad | Base | Fluctuacion | Warning | Critical | Spike Prob |
|------|--------|------|-------------|---------|----------|------------|
| `PRESION` | psi | 45 | ±8 | 80 | 100 | 3% |
| `TEMPERATURA` | °C | 65 | ±12 | 78 | 90 | 4% |
| `GAS` | %LEL | 1.5 | ±1.0 | 3.5 | 5.0 | 5% |
| `VOLTAJE` | V | 220 | ±15 | 240 | 250 | 2% |

### 3.3 Ingesta de Datos Reales (Produccion)

#### Metodo 1: API REST (Webhook)

```bash
# Envio de lectura de sensor via API
# NOTA: Esta funcionalidad se implementa en el backend
# usando la funcion ingestSensorData() del motor SCADA

# Actualmente, los datos se ingieren a traves de:
# 1. Crear un endpoint webhook dedicado que llame a ingestSensorData()
# 2. O usar un mini-servicio MQTT que se conecte al motor

# Ejemplo de estructura de datos esperada:
POST /api/sensors/webhook
{
  "sensorId": "clave_sensor_123",
  "value": 87.3,
  "timestamp": "2025-01-15T14:30:00Z"
}
```

#### Metodo 2: Directo via Motor (Recomendado para Produccion)

```typescript
// En su mini-servicio o integracion:
import { ingestSensorData } from '@/lib/scada/engine'

// Ingestar lectura desde MQTT/Webhook
const result = await ingestSensorData(
  'sensor-uuid-aqui',  // ID del sensor en la BD
  87.3,                // Valor numerico
  'mqtt'               // Fuente: 'webhook' | 'mqtt' | 'manual'
)

// La funcion automaticamente:
// 1. Valida que el sensor existe y esta activo
// 2. Calcula el estado (NORMAL/WARNING/CRITICO)
// 3. Actualiza currentValue y lastReadingAt
// 4. Guarda la lectura en SensorReading
// 5. Limpia lecturas antiguas (mantiene ultimas 200)
```

#### Metodo 3: Conectar Sensores Fisicos via MQTT

Para produccion, se recomienda crear un mini-servicio MQTT:

```
mini-services/mqtt-bridge/
  ├── index.ts          # Suscriptor MQTT → ingestSensorData()
  ├── config.ts         # Host, topic, credenciales
  └── package.json
```

### 3.4 Security Gate (Interlock de Seguridad)

El sistema implementa un interlock que **bloquea la firma de permisos** cuando cualquier sensor esta en estado CRITICO:

```
ApprovalPanel (Frontend)
  │
  ├── Polling cada 5s → GET /api/sensors/site-safe
  │
  ├── Si isSafe = false:
  │   ├── Muestra banner "BLOQUEADO: Alerta SCADA Detectada"
  │   └── Deshabilita botones Aprobar/Rechazar
  │
  └── Si isSafe = true:
      ├── Muestra "Cumplimiento OK — SCADA: OK"
      └── Permite operaciones normales
```

**Logica del backend** (`isSiteSafe()`):
```typescript
// Consulta todos los sensores activos de la ubicacion
// Si ALGUN sensor tiene value >= thresholdCritical → isSafe = false
// Retorna lista de sensores criticos y en advertencia
```

### 3.5 Control de Simulacion

```bash
# Activar modo demo (datos simulados)
POST /api/sensors/simulation
{ "enabled": true }

# Desactivar modo demo (espera datos reales)
POST /api/sensors/simulation
{ "enabled": false }

# Consultar estado actual
GET /api/sensors/simulation
→ { "demoMode": true/false }
```

> **Nota**: El modo simulacion es global (afecta a todas las empresas). En produccion con datos reales, debe desactivarse.

---

## 4. Circuito de Cumplimiento HSE

### 4.1 Capas de Bloqueo

El sistema implementa **4 capas de seguridad independientes** que deben pasar para que un permiso sea aprobado:

```
                   Flujo de Aprobacion de Permiso
                   ══════════════════════════════

  [1] SUSCRIPCION ACTIVA
      │ checkSubscription(companyId)
      ├── Trial expirado (7 dias) + sin plan → BLOCKED
      ├── Suscripcion PAST_DUE → BLOCKED
      ├── Suscripcion CANCELLED → BLOCKED
      └── Suscripcion ACTIVE → OK ▼

  [2] CUMPLIMIENTO HSE
      │ enforceCompliance(userId, companyId)
      ├── Documentos CRITICOS vencidos → BLOCKED
      │   "BLOQUEADO POR CUMPLIMIENTO HSE: ..."
      └── Sin documentos criticos vencidos → OK ▼

  [3] GEOFENCA GPS
      │ checkGeofence(supervisorGPS, workLocation, radius)
      ├── Supervisor fuera del radio → BLOCKED
      │   "Distancia: 350m (maximo: 100m)"
      └── Supervisor dentro del radio → OK ▼

  [4] SCADA SECURITY GATE
      │ isSiteSafe(locationId, companyId)
      ├── Cualquier sensor CRITICO → BLOCKED
      │   "BLOQUEADO: Alerta SCADA Detectada"
      └── Todos los sensores OK → OK ▼

                   ═══════════════════
                   Permiso APROBADO
                   PDF generado con:
                   - Firma digital + hash SHA-256
                   - Coordenadas GPS del supervisor
                   - Estado de geocerca
                   - Fotografias de evidencia
```

### 4.2 Bloqueo por Documentos HSE Vencidos

**Logica** (`checkUserCompliance()`):

```typescript
// 1. Obtiene todos los documentos activos con fecha de expiracion
// 2. Filtra por companyId (multi-tenancy)
// 3. Si el documento esta asignado a un userId, filtra tambien por usuario
// 4. Documentos CRITICOS con expiryDate < ahora → NON_COMPLIANT
// 5. Documentos CRITICOS con expiryDate en proximos 30 dias → WARNING
```

**Tipos de bloqueo**:
- `CRITICAL`: Bloquea TODAS las operaciones (crear permisos, aprobar, rechazar)
- `NORMAL`: No bloquea operaciones

**Mensaje de error**:
```
BLOQUEADO POR CUMPLIMIENTO HSE: El usuario tiene 2 documento(s) critico(s)
vencido(s): "Certificacion de Altura" (15 dias vencido), "Curso de
Espacios Confinados" (3 dias vencido). Renueve los documentos antes de continuar.
```

### 4.3 Validacion por Geocerca GPS

**Algoritmo**: Formula de Haversine para calcular distancia entre dos coordenadas GPS.

```typescript
// checkGeofence(supervisorPosition, workLocation, radiusMeters)
// 1. Calcula distancia en metros usando Haversine
// 2. Compara con radio configurado en la ubicacion de trabajo
// 3. Retorna { isWithinRadius, distanceMeters, radiusMeters }
// 4. Si isWithinRadius = false → ERROR 403 con detalles de distancia
```

**Firma digital con GPS**:
- La firma del supervisor incluye: coordenadas GPS, precision, timestamp, hash SHA-256
- Se almacena tanto en la tabla `Signature` como en el campo `supervisorSignature` del permiso
- El PDF generado incluye todos los datos de geolocalizacion

### 4.4 Bloqueo por Alertas SCADA

Vea la seccion [3.4 Security Gate](#34-security-gate-interlock-de-seguridad) para detalles.

---

## 5. Administracion Global (Super Admin)

### 5.1 Acceso al Panel

- **URL**: Navegar a la vista `admin-portal-hq` desde el sidebar
- **Requisito**: Rol `SUPER_ADMIN`
- **Credenciales demo**: `superadmin@energycompliance.com` / `admin123`

### 5.2 Funcionalidades del Centro de Mando

#### Dashboard Estadistico
- Total de empresas registradas
- Empresas activas (suscripcion ACTIVE)
- Empresas en trial
- Empresas con pago vencido (PAST_DUE)

#### Gestion de Empresas
- Tabla con busqueda por nombre/email
- Columnas: Nombre, Plan, Estado, Usuarios, Fecha de creacion
- **Boton "Activar Enterprise"**: Solo visible para empresas que NO tienen plan enterprise

#### Logs de Auditoria Expandible
- Clic en "Logs" para ver los ultimos registros de auditoria de cada empresa
- Filtros: Accion (CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN), Tipo de entidad, Usuario

### 5.3 Activacion de Plan Enterprise

**Proceso**:

1. El SUPER_ADMIN busca la empresa en la tabla
2. Clic en "Activar Enterprise" → Abre dialogo de confirmacion
3. El dialogo muestra:
   - Nombre y email de la empresa
   - Plan actual → Plan Enterprise
   - Advertencia: "Se otorgaran 999,999 usuarios y permisos ilimitados por 1 ano"
4. Clic en "Confirmar Activacion" → Llama a `POST /api/admin/activate-enterprise`

**Efecto inmediato**:
```json
{
  "subscriptionPlan": "enterprise",
  "subscriptionStatus": "ACTIVE",
  "maxUsers": 999999,
  "maxPermitsPerMonth": 999999,
  "subscriptionExpiresAt": "+1 ano desde ahora"
}
```

**Refresco de UI**:
- Despues de la activacion, el panel ejecuta `fetchCompanies()` automaticamente
- La tabla se actualiza instantaneamente reflejando el nuevo plan y estado
- El boton "Activar Enterprise" desaparece para esa empresa

### 5.4 Log de Auditoria de la Activacion

Cada activacion enterprise queda registrada:

```json
{
  "action": "UPDATE",
  "entityType": "COMPANY",
  "details": {
    "reason": "SUPER_ADMIN enterprise activation",
    "previousPlan": "starter",
    "previousStatus": "TRIAL",
    "newPlan": "enterprise",
    "newStatus": "ACTIVE"
  }
}
```

### 5.5 Monitoreo de Periodo de Gracia

El sistema calcula automaticamente el periodo de trial:

```
trialEnd = company.createdAt + plan.trialDays * 24 * 60 * 60 * 1000

trialDaysRemaining = ceil((trialEnd - now) / 86400000)

isTrialExpired = trialDaysRemaining < 0 AND subscriptionStatus !== 'ACTIVE'
```

**Bloqueo cuando expira**:
- **Cliente**: Banner amarillo "Acceso Limitado" con boton "Actualizar Plan"
- **Servidor**: Todas las operaciones de escritura (POST) retornan 403 con `SUBSCRIPTION_EXPIRED`
- **Excepciones**: Las operaciones de lectura (GET) y el panel de suscripcion siguen accesibles

---

## 6. Auditoria de Seguridad Multi-Tenancy

### 6.1 Regla de Oro

> **TODAS las consultas a Prisma utilizan el `companyId` extraido del JWT del usuario. El sistema ignora cualquier ID de empresa que venga por parametro externo si no coincide con el del token.**

### 6.2 Resultado de la Auditoria

| API Route | Metodo | companyId Source | Aislamiento | Estado |
|-----------|--------|-----------------|-------------|--------|
| `/api/sensors` | GET | `payload.companyId` | `where: { companyId }` | ✅ OK |
| `/api/sensors` | POST | `payload.companyId` | `data: { companyId }` | ✅ OK |
| `/api/sensors/[id]` | GET | `payload.companyId` | `where: { id, companyId }` | ✅ OK |
| `/api/sensors/[id]` | PUT | `payload.companyId` | `findFirst: { id, companyId }` | ✅ OK |
| `/api/sensors/[id]` | DELETE | `payload.companyId` | `findFirst: { id, companyId }` | ✅ OK |
| `/api/sensors/[id]/readings` | GET | `payload.companyId` | `getSensorReadings(id, companyId)` | ✅ OK |
| `/api/sensors/telemetry` | GET | `payload.companyId` | `getTelemetry(companyId)` | ✅ OK |
| `/api/sensors/site-safe` | GET | `payload.companyId` | `isSiteSafe(id, companyId)` / `isCompanySafe(companyId)` | ✅ OK |
| `/api/sensors/simulation` | POST | N/A | Toggle global (sin datos sensibles) | ✅ OK |
| `/api/permits` | GET | `session.companyId` | `where: { companyId }` | ✅ OK |
| `/api/permits` | POST | `session.companyId` | `data: { companyId }` | ✅ OK |
| `/api/permits/[id]/approve` | POST | `session.companyId` | `findFirst: { id, companyId }` | ✅ OK |
| `/api/permits/[id]/reject` | POST | `session.companyId` | `findFirst: { id, companyId }` | ✅ OK |
| `/api/predictive/insights` | GET | `session.companyId` | `where: { companyId, isActive }` | ✅ OK |
| `/api/compliance/check` | GET | `session.companyId` | `checkUserCompliance(userId, companyId)` | ✅ OK |
| `/api/subscription/status` | GET | `payload.companyId` | `where: { id: companyId }` | ✅ OK |
| `/api/documents` | GET | `session.companyId` | `where: { companyId }` | ✅ OK |
| `/api/documents` | POST | `session.companyId` | `data: { companyId }` | ✅ OK |
| `/api/locations` | GET | `session.companyId` | `where: { companyId }` | ✅ OK |
| `/api/locations` | POST | `session.companyId` | `data: { companyId }` | ✅ OK |
| `/api/admin/activate-enterprise` | POST | N/A (SUPER_ADMIN) | `companyId` del body (solo SUPER_ADMIN) | ✅ OK |

### 6.3 Protecciones Implementadas

1. **JWT Immutable**: El `companyId` en el token no puede ser modificado por el cliente (firmado con HS256)
2. **Parametros ignorados**: Ninguna ruta acepta `companyId` como query param para consultas de datos
3. **findFirst vs findUnique**: Las rutas que acceden por ID usan `findFirst({ where: { id, companyId } })` en lugar de `findUnique({ where: { id } })` para garantizar el aislamiento
4. **SUPER_ADMIN exception**: Solo la ruta `/api/admin/activate-enterprise` acepta `companyId` del body, y esta protegida por `session.role !== 'SUPER_ADMIN'`

### 6.4 Nota sobre Simulacion Global

El modo de simulacion (`/api/sensors/simulation`) es un toggle global en memoria que afecta a todas las empresas. Esto es aceptable porque:
- No expone datos de ninguna empresa
- Solo controla si los valores son generados por simulacion o por hardware real
- En produccion con datos reales, se desactiva globalmente

---

## 7. Sistema de Suscripciones y Pagos

### 7.1 Planes Disponibles

| Plan | Precio | Usuarios Max | Permisos/Mes | Trial | SCADA | IA Predictiva |
|------|--------|-------------|--------------|-------|-------|---------------|
| Starter | $149/mes | 10 | 200 | 7 dias | No | No |
| Business | $499/mes | 50 | 2,000 | 7 dias | Basico | Si |
| Enterprise | Contactar | Ilimitado | Ilimitado | N/A | Avanzado | Avanzada |

### 7.2 Modo Demo vs Produccion

```
isDemoMode = !STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.includes('placeholder')
```

| Aspecto | Modo Demo | Modo Produccion |
|---------|-----------|-----------------|
| Activacion de plan | Instantanea (clic) | Via Stripe Checkout |
| Boton visible | "Activar Demo" | "Suscribirme" → Stripe |
| Enterprise | Contactar formulario | Contactar formulario |
| Facturacion | Sin invoice real | Invoice en BD + Stripe |

### 7.3 Flujo de Pago con Stripe

```
Usuario clic "Suscribirme"
  │
  ├── Modal de confirmacion (resumen del plan)
  │
  ├── POST /api/subscription → Crea Checkout Session
  │     { sessionId, url: "https://checkout.stripe.com/..." }
  │
  ├── Redireccion a Stripe Checkout (nueva pestana)
  │
  ├── Pago exitoso → Stripe redirige a /api/subscription/success
  │     └── Polling cada 2s al endpoint de webhook
  │
  ├── Webhook Stripe (POST /api/subscription/webhook)
  │     └── Actualiza: plan, status=ACTIVE, expiresAt
  │
  └── Usuario redirigido al dashboard con plan activo
```

### 7.4 Bloqueo Server-Side por Suscripcion

A partir de esta actualizacion, las siguientes rutas POST verifican la suscripcion activa antes de procesar:

- `POST /api/permits` — Crear permiso
- `POST /api/sensors` — Crear sensor
- `POST /api/permits/[id]/approve` — Aprobar permiso
- `POST /api/permits/[id]/reject` — Rechazar permiso
- `POST /api/documents` — Crear documento HSE
- `POST /api/locations` — Crear ubicacion

Si la suscripcion esta bloqueada, todas retornan:
```json
{ "error": "ACCESO BLOQUEADO: Trial expirado...", "code": "SUBSCRIPTION_EXPIRED" }
→ HTTP 403
```

---

## 8. Referencia de API

### 8.1 Autenticacion

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login con email/password → JWT |
| `/api/auth/register` | POST | Registro de nueva empresa + usuario |

### 8.2 Permisos

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/permits` | GET | Listar permisos (filtro: `?status=PENDING`) |
| `/api/permits` | POST | Crear permiso (requiere cumplimiento HSE) |
| `/api/permits/[id]` | GET | Obtener detalle de permiso |
| `/api/permits/[id]/approve` | POST | Aprobar permiso (GPS + firma + SCADA) |
| `/api/permits/[id]/reject` | POST | Rechazar permiso (razon requerida) |
| `/api/permits/[id]/pdf` | GET | Regenerar PDF del permiso |

### 8.3 SCADA / Telemetria

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/sensors` | GET | Listar sensores (`?locationId=`, `?type=`) |
| `/api/sensors` | POST | Crear sensor (ADMIN/SUPERVISOR/MANAGER) |
| `/api/sensors/[id]` | GET/PUT/DELETE | CRUD individual |
| `/api/sensors/[id]/readings` | GET | Historial (`?limit=60`, max 200) |
| `/api/sensors/telemetry` | GET | Telemetria en tiempo real |
| `/api/sensors/site-safe` | GET | Security Gate (`?locationId=`) |
| `/api/sensors/simulation` | GET/POST | Toggle modo demo |

### 8.4 IA Predictiva

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/predictive/insights` | GET | Analisis predictivo (cache 5 min) |

### 8.5 Cumplimiento

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/compliance/check` | GET | Estado de cumplimiento HSE |
| `/api/documents` | GET/POST | Documentos HSE |
| `/api/locations` | GET/POST | Ubicaciones de trabajo |

### 8.6 Administracion (SUPER_ADMIN)

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/admin/companies` | GET | Todas las empresas |
| `/api/admin/activate-enterprise` | POST | Activar plan Enterprise |
| `/api/admin/audit-logs` | GET | Logs (`?companyId=`) |

### 8.7 Suscripcion

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/subscription` | GET | Planes disponibles |
| `/api/subscription` | POST | Iniciar suscripcion/checkout |
| `/api/subscription/status` | GET | Estado de suscripcion |
| `/api/subscription/contact` | POST | Formulario Enterprise |
| `/api/subscription/webhook` | POST | Stripe webhook |
| `/api/subscription/success` | GET | Pagina post-pago |

### 8.8 API Externa

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/v1/external/stats` | GET | Estadisticas publicas (requiere API key) |

---

## 9. Credenciales de Demostracion

| Rol | Email | Password |
|-----|-------|----------|
| ADMIN (empresa demo) | `admin@energy.com` | `admin123` |
| SUPER_ADMIN | `superadmin@energycompliance.com` | `admin123` |
| SUPERVISOR | `supervisor@energy.com` | `admin123` |
| TECHNICIAN | `tecnico@energy.com` | `admin123` |

---

## 10. Variables de Entorno

### Requeridas

| Variable | Descripcion |
|----------|-------------|
| `JWT_SECRET` | Clave para firmar JWT (fallback: hardcoded) |

### Opcionales — IA Predictiva

| Variable | Descripcion | Default |
|----------|-------------|---------|
| `DEEPSEEK_API_KEY` | API key de DeepSeek | — (usa fallback) |
| `DEEPSEEK_API_URL` | URL base API DeepSeek | `https://api.deepseek.com/v1` |

### Opcionales — Stripe (Produccion)

| Variable | Descripcion |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_STARTER_PRICE_ID` | Price ID del plan Starter |
| `STRIPE_BUSINESS_PRICE_ID` | Price ID del plan Business |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |

### Opcionales — API Externa

| Variable | Descripcion |
|----------|-------------|
| `PAPERCLIP_API_KEY` | API key para endpoint externo |

---

*Documento generado automaticamente a partir del codigo fuente de Energy-Compliance Hub.*
*Ultima actualizacion: Auditoria de seguridad, navegacion y documentacion — Julio 2025.*

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { BookOpen, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Cpu, Wifi, Database, Code, Shield, Activity, Settings, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────

interface SectionProps {
  id: string
  title: string
  icon: React.ReactNode
  badge?: string
  children: React.ReactNode
}

// ── Code Block Helper ──────────────────────────────────────

function CodeBlock({ code, language = '' }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-[11px] text-slate-400 font-mono">{language || 'código'}</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
      </div>
      <pre className="bg-slate-900 p-4 overflow-x-auto">
        <code className="text-[13px] leading-relaxed text-emerald-400 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  )
}

// ── Collapsible Section ────────────────────────────────────

function Section({ id, title, icon, badge, children }: SectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <Card
      id={id}
      className={cn(
        'border transition-all duration-200',
        open ? 'border-emerald-300 shadow-md shadow-emerald-50' : 'border-slate-200 hover:border-slate-300'
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left"
      >
        <CardHeader className="py-4 px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg transition-colors',
                open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              )}>
                {icon}
              </div>
              <div>
                <CardTitle className={cn(
                  'text-base transition-colors',
                  open ? 'text-emerald-800' : 'text-slate-800'
                )}>
                  {title}
                </CardTitle>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {badge && (
                <Badge className={cn(
                  'text-[10px] font-medium',
                  open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                )}>
                  {badge}
                </Badge>
              )}
              {open ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>
        </CardHeader>
      </button>

      {open && (
        <div className="px-5 pb-5">
          <Separator className="mb-4" />
          <div className="prose prose-slate prose-sm max-w-none space-y-4">
            {children}
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Info / Warning / Tip Boxes ─────────────────────────────

function InfoBox({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warning' | 'tip' }) {
  const styles = {
    info: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    tip: 'bg-slate-50 border-slate-200 text-slate-700',
  }

  const icons = {
    info: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
    tip: <BookOpen className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />,
  }

  return (
    <div className={cn('flex gap-2.5 p-3.5 rounded-lg border text-sm', styles[type])}>
      {icons[type]}
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  )
}

// ── Table Component ────────────────────────────────────────

function SpecTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/50">
              {row.map((cell, j) => (
                <td key={j} className={cn(
                  'px-4 py-2.5 text-slate-600',
                  j === 0 ? 'font-medium text-slate-700' : ''
                )}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Subsection Title ───────────────────────────────────────

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mt-6 mb-2">
      <span className="w-1 h-4 rounded-full bg-emerald-500" />
      {children}
    </h4>
  )
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
}

// ── Step List ──────────────────────────────────────────────

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-slate-600 leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TechnicalManual() {
  const [allExpanded, setAllExpanded] = useState(false)

  const toggleAll = () => {
    setAllExpanded(!allExpanded)
    // Click all section buttons to toggle them
    document.querySelectorAll('[data-section-toggle]').forEach((btn) => {
      const isCurrentlyOpen = btn.getAttribute('aria-expanded') === 'true'
      if (allExpanded && isCurrentlyOpen) {
        // We want all open, but this one is already open — skip
      } else if (!allExpanded && !isCurrentlyOpen) {
        // We want all closed, but this one is already closed — skip
      }
      // Trigger click
      if (allExpanded !== isCurrentlyOpen) {
        btn.click()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <BookOpen className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Manual Técnico — SCADA</h1>
              <p className="text-emerald-300/80 text-sm mt-1">
                Guía completa de integración de sensores físicos con la plataforma Energy-Compliance Hub
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  v3.1
                </Badge>
                <Badge className="bg-slate-700 text-slate-300 text-[10px]">
                  Arquitectura Next.js 15
                </Badge>
                <Badge className="bg-slate-700 text-slate-300 text-[10px]">
                  Prisma ORM
                </Badge>
                <Badge className="bg-slate-700 text-slate-300 text-[10px]">
                  SQLite
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Métodos de Integración', value: '4', icon: <Wifi className="w-4 h-4" /> },
            { label: 'Endpoints API', value: '10+', icon: <Code className="w-4 h-4" /> },
            { label: 'Tipos de Sensor', value: '4', icon: <Cpu className="w-4 h-4" /> },
            { label: 'Seguridad', value: 'JWT + API Key', icon: <Shield className="w-4 h-4" /> },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <div className="text-emerald-400">{stat.icon}</div>
              <div>
                <p className="text-emerald-300 font-bold text-sm">{stat.value}</p>
                <p className="text-slate-400 text-[10px]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table of Contents ──────────────────────────── */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 px-5">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Tabla de Contenidos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { id: 'arquitectura', label: '1. Arquitectura del Sistema', icon: <Database className="w-3.5 h-3.5" /> },
              { id: 'metodos-integracion', label: '2. Métodos de Integración', icon: <Wifi className="w-3.5 h-3.5" /> },
              { id: 'api-reference', label: '3. Referencia de API', icon: <Code className="w-3.5 h-3.5" /> },
              { id: 'formatos-datos', label: '4. Formatos de Datos', icon: <Database className="w-3.5 h-3.5" /> },
              { id: 'registro-sensor', label: '5. Registro de Sensores', icon: <Cpu className="w-3.5 h-3.5" /> },
              { id: 'umbrales', label: '6. Configuración de Umbrales', icon: <Settings className="w-3.5 h-3.5" /> },
              { id: 'autenticacion', label: '7. Autenticación y Seguridad', icon: <Shield className="w-3.5 h-3.5" /> },
              { id: 'testing', label: '8. Pruebas y Validación', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              { id: 'solucion-problemas', label: '9. Solución de Problemas', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                <span className="text-emerald-500">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Sections ────────────────────────────────────── */}
      <div className="space-y-3">

        {/* ============================================================
            SECCIÓN 1: ARQUITECTURA DEL SISTEMA
            ============================================================ */}
        <Section
          id="arquitectura"
          title="1. Arquitectura del Sistema SCADA"
          icon={<Database className="w-4 h-4" />}
          badge="Fundamentos"
        >
          <Paragraph>
            El módulo SCADA de Energy-Compliance Hub opera bajo una arquitectura de <strong>dual-mode</strong>: datos simulados (demo) y datos reales de sensores físicos. El sistema está construido sobre Next.js 15 App Router con API Routes como backend, Prisma ORM para persistencia y SQLite como base de datos.
          </Paragraph>

          <SubTitle>Flujo de Datos General</SubTitle>
          <CodeBlock language="diagram — Flujo de Arquitectura" code={`┌─────────────────────────────────────────────────────────────────┐
│                    FUENTES DE DATOS                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Sensor   │ │ Modbus   │ │  MQTT    │ │ OPC-UA   │     │
│  │ Físico   │ │ Gateway  │ │ Broker   │ │ Servidor │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       │            │            │            │             │
│       ▼            ▼            ▼            ▼             │
│  ┌──────────────────────────────────────────────────┐     │
│  │         API INGEST: /api/sensors/ingest          │     │
│  │         (Webhook HTTP receptor)                   │     │
│  └────────────────────┬─────────────────────────────┘     │
│                       │                                   │
│                       ▼                                   │
│  ┌──────────────────────────────────────────────────┐     │
│  │         MOTOR SCADA (engine.ts)                   │     │
│  │  • ingestSensorData() — Almacena lecturas        │     │
│  │  • getSensorStatus() — Evalúa umbrales           │     │
│  │  • isSiteSafe() — Security Gate interlock        │     │
│  │  • isCompanySafe() — Verificación global         │     │
│  └────────────────────┬─────────────────────────────┘     │
│                       │                                   │
│              ┌────────┴────────┐                          │
│              ▼                 ▼                          │
│  ┌──────────────────┐ ┌──────────────────┐               │
│  │  Base de Datos   │ │  Cache Memoria   │               │
│  │  (SQLite/Prisma) │ │  (demoModeCache) │               │
│  │                  │ │                  │               │
│  │  • Sensor        │ │  • Estado demo   │               │
│  │  • SensorReading │ │  • Valores prev  │               │
│  │  • Company       │ │                  │               │
│  └────────┬─────────┘ └──────────────────┘               │
│           │                                                │
│           ▼                                                │
│  ┌──────────────────────────────────────────────────┐     │
│  │   TELEMETRY API: /api/sensors/telemetry          │     │
│  │   (GET — devuelve puntos + estado seguridad)     │     │
│  └────────────────────┬─────────────────────────────┘     │
│                       │                                   │
│                       ▼                                   │
│  ┌──────────────────────────────────────────────────┐     │
│  │   FRONTEND (telemetry-board.tsx)                 │     │
│  │   • Polling cada 3 segundos                      │     │
│  │   • Indicadores LED (verde/ámbar/rojo)          │     │
│  │   • Gráficos de tendencia (Recharts)             │     │
│  │   • Toggle Modo Demo vs Real                     │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘`} />

          <SubTitle>Componentes Clave</SubTitle>
          <SpecTable
            headers={['Componente', 'Ruta / Archivo', 'Descripción']}
            rows={[
              ['Motor SCADA', 'src/lib/scada/engine.ts', 'Simulación Brownian motion, ingest webhook, safety gates'],
              ['Cache Demo Mode', 'src/lib/demo-mode-cache.ts', 'Mapa en memoria para estado demo por compañía'],
              ['Base de Datos', 'prisma/schema.prisma', 'Modelos Sensor y SensorReading con índices'],
              ['API Telemetría', '/api/sensors/telemetry', 'GET — Retorna todos los puntos de un tenant'],
              ['API Ingest', '/api/sensors/ingest', 'POST — Recibe datos de sensores externos'],
              ['API CRUD Sensores', '/api/sensors/*', 'GET/POST/PUT/DELETE — Gestión de sensores'],
              ['Panel Frontend', 'src/components/scada/telemetry-board.tsx', 'Tablero con polling, gráficos y LED'],
              ['Safety Gate', 'isSiteSafe() / isCompanySafe()', 'Bloquea aprobación cuando sensores = CRÍTICO'],
              ['Geofence System', 'src/lib/gps.ts + /api/permits/[id]/approve', 'Verificación GPS Haversine para firma y aprobación/rechazo'],
              ['API Keys CRUD', '/api/api-keys', 'POST/GET/DELETE — Creación, listado y revocación de credenciales API'],
              ['Middleware Proxy', 'src/proxy.ts', 'Gateo de plan (starter/business/enterprise) para endpoints protegidos'],
              ['Service Worker', 'public/sw.js', 'Cache offline con estrategias networkOnlyWithLastCache + staleWhileRevalidate'],
            ]}
          />

          <SubTitle>Modelo de Base de Datos</SubTitle>
          <CodeBlock language="prisma/schema.prisma — Modelos Sensor y SensorReading" code={`model Sensor {
  id                String   @id @default(cuid())
  companyId         String                    // Multi-tenant
  locationId        String?                   // Ubicación opcional
  name              String                    // Nombre del sensor
  type              String                    // PRESION|TEMPERATURA|GAS|VOLTAJE
  currentValue      Float?                    // Última lectura
  unit              String                    // psi|°C|%LEL|V
  thresholdCritical Float                     // Umbral crítico
  thresholdWarning  Float   @default(0)       // Umbral advertencia
  isSimulated       Boolean  @default(true)   // ¿Es simulado?
  isActive          Boolean  @default(true)   // ¿Está activo?
  lastReadingAt     DateTime?                 // Timestamp última lectura
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  readings          SensorReading[]
}

model SensorReading {
  id        String   @id @default(cuid())
  sensorId  String
  value     Float                        // Valor numérico
  status    String                       // NORMAL|WARNING|CRITICO
  timestamp DateTime @default(now())      // Momento de la lectura
}`} />

          <SubTitle>Mecanismo de Polling del Frontend</SubTitle>
          <Paragraph>
            El tablero de telemetría implementa un mecanismo de <strong>polling</strong> cada 3 segundos utilizando <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">setInterval</code> contra el endpoint <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">/api/sensors/telemetry</code>. El estado del modo demo se carga <strong>una sola vez</strong> al montar el componente y se gestiona de forma independiente para evitar condiciones de carrera.
          </Paragraph>
          <CodeBlock language="typescript — Patrón de Polling (telemetry-board.tsx)" code={`// Carga inicial — solo una vez al montar
useEffect(() => {
  loadSensors()
  loadLocations()
  loadDemoMode()   // Carga estado demo ONCE
}, [loadSensors, loadLocations, loadDemoMode])

// Polling de telemetría cada 3 segundos
useEffect(() => {
  loadTelemetry()
  pollRef.current = setInterval(() => {
    loadTelemetry()  // NO toca demoMode
  }, 3000)
  return () => { if (pollRef.current) clearInterval(pollRef.current) }
}, [loadTelemetry])`} />

          <InfoBox type="tip">
            El modo demo se persiste en la base de datos (campo <code className="font-mono text-xs">Company.scadaDemoMode</code>) y sobrevive reinicios del servidor. Cada compañía puede habilitar/deshabilitar la simulación independientemente.
          </InfoBox>
        </Section>

        {/* ============================================================
            SECCIÓN 2: MÉTODOS DE INTEGRACIÓN
            ============================================================ */}
        <Section
          id="metodos-integracion"
          title="2. Métodos de Integración de Sensores"
          icon={<Wifi className="w-4 h-4" />}
          badge="4 Protocolos"
        >
          <InfoBox type="warning">
            <strong>Nota importante:</strong> La plataforma expone un único endpoint receptor HTTP (<code className="font-mono text-xs">POST /api/sensors/ingest</code>). Los 4 métodos descritos a continuación son <strong>arquitecturas de referencia</strong> — patrones recomendados que utilizan un gateway o puente externo para traducir el protocolo industrial (Modbus, MQTT, OPC-UA) hacia peticiones HTTP estándar. Los códigos de ejemplo son para implementar en el lado del cliente (edge device), no están integrados nativamente en la plataforma.
          </InfoBox>

          <Paragraph>
            A continuación se documentan 4 patrones de integración para conectar sensores físicos reales al endpoint de ingest de la plataforma. Cada patrón tiene ventajas según el tipo de instalación industrial y la infraestructura disponible.
          </Paragraph>

          <SubTitle>2.1 HTTP Webhook (Recomendado para IoT moderno)</SubTitle>
          <Paragraph>
            El método más simple: el sensor o dispositivo IoT envía lecturas directamente a nuestro endpoint HTTP mediante peticiones POST. Ideal para sensores WiFi, dispositivos LoRaWAN con gateway HTTP, o cualquier sistema que pueda hacer HTTP/HTTPS.
          </Paragraph>

          <CodeBlock language="bash — Envío de lectura vía cURL" code={`# Enviar una lectura de sensor al endpoint de ingest
curl -X POST https://su-plataforma.com/api/sensors/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "X-API-Key: su-api-key-aqui" \\
  -d '{
    "sensorId": "clxxxxx...sensorid",
    "value": 72.4,
    "timestamp": "2025-01-15T14:30:00Z"
  }'

# Respuesta exitosa (200 OK):
# {
#   "success": true,
#   "sensorId": "clxxxxx...",
#   "value": 72.4,
#   "status": "NORMAL",
#   "timestamp": "2025-01-15T14:30:00.000Z"
# }`} />

          <CodeBlock language="python — Ejemplo con Python (requests)" code={`import requests
import time
from datetime import datetime, timezone

API_URL = "https://su-plataforma.com/api/sensors/ingest"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_JWT_TOKEN",
    "X-API-Key": "su-api-key-aqui"
}

def enviar_lectura(sensor_id: str, valor: float):
    payload = {
        "sensorId": sensor_id,
        "value": valor,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    response = requests.post(API_URL, json=payload, headers=HEADERS)
    print(f"Status: {response.status_code}")
    print(f"Respuesta: {response.json()}")
    return response.json()

# Ejemplo: enviar lectura cada 5 segundos
SENSOR_ID = "clxxxxx...su-sensor-id"
while True:
    # Simular lectura de sensor físico (ej: GPIO, puerto serial)
    valor = leer_sensor_fisico()
    enviar_lectura(SENSOR_ID, valor)
    time.sleep(5)`} />

          <CodeBlock language="javascript — Ejemplo con Node.js (fetch)" code={`// sensor-publisher.js — Publica lecturas cada 3 segundos
const API_URL = 'https://su-plataforma.com/api/sensors/ingest'
const API_KEY = 'su-api-key-aqui'
const JWT_TOKEN = 'your-jwt-token'

async function enviarLectura(sensorId, value) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      sensorId,
      value,
      timestamp: new Date().toISOString()
    })
  })

  if (!res.ok) {
    console.error(\`Error \${res.status}: \${await res.text()}\`)
    return false
  }

  const data = await res.json()
  console.log(\`✓ Enviado: \${data.value} → \${data.status}\`)
  return true
}

// Bucle principal
const SENSOR_ID = 'clxxxxx...su-sensor-id'
setInterval(async () => {
  const valor = leerSensorFisico() // Implementar según hardware
  await enviarLectura(SENSOR_ID, valor)
}, 3000)`} />

          <SubTitle>2.2 Modbus TCP/RTU (Vía Gateway Edge)</SubTitle>
          <Paragraph>
            Para sensores industriales que usan el protocolo Modbus (TCP o RTU serial), se requiere un <strong>gateway middleware</strong> que traduzca las tramas Modbus a peticiones HTTP hacia nuestra API. El gateway actúa como puente entre el bus industrial y la nube.
          </Paragraph>

          <CodeBlock language="diagram — Arquitectura Modbus" code={`┌──────────────┐     Modbus TCP/RTU     ┌───────────────────┐
│  Sensores     │◄────────────────────────►│  Gateway Edge     │
│  Industriales │  (RS-485 / Ethernet)     │  (Raspberry Pi /  │
│               │                          │   PC Industrial)  │
│  • Presión    │                          └────────┬──────────┘
│  • Temp.      │                                   │
│  • Gas LEL    │                                   HTTP POST
│  • Voltaje    │                                   ▼
└──────────────┘                          ┌───────────────────┐
                                           │  API Ingest       │
                                           │  /api/sensors/    │
                                           │  ingest           │
                                           └───────────────────┘`} />

          <CodeBlock language="python — Gateway Modbus TCP (usando pymodbus)" code={`# modbus_gateway.py — Gateway que lee registros Modbus y envía a la API
from pymodbus.client import ModbusTcpClient
import requests
import time

# Configuración
MODBUS_HOST = "192.168.1.100"   # IP del dispositivo Modbus
MODBUS_PORT = 502               # Puerto estándar Modbus TCP
API_URL = "https://su-plataforma.com/api/sensors/ingest"
API_KEY = "su-api-key-aqui"
JWT_TOKEN = "your-jwt-token"

# Mapeo de registros Modbus → Sensores en la plataforma
# Formato: { registro_modbus: { sensorId, funcion, tipo }
MAPEO_SENSORES = {
    0: {
        "sensorId": "clxxxxx...sensor-presion",
        "funcion": 3,          # Holding Register (lectura)
        "tipo": "presion",
        "factor": 0.1,         # Escalar: registro / 10 = psi
    },
    1: {
        "sensorId": "clxxxxx...sensor-temperatura",
        "funcion": 3,
        "tipo": "temperatura",
        "factor": 0.1,
    },
    2: {
        "sensorId": "clxxxxx...sensor-gas",
        "funcion": 3,
        "tipo": "gas",
        "factor": 0.01,
    },
}

def leer_y_enviar(client: ModbusTcpClient):
    """Lee todos los registros Modbus y envía a la API."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {JWT_TOKEN}",
        "X-API-Key": API_KEY
    }

    for registro, config in MAPEO_SENSORES.items():
        try:
            # Leer registro Modbus
            resultado = client.read_holding_registers(
                address=registro, count=1, slave=1
            )
            if resultado.isError():
                print(f"⚠ Error leyendo registro {registro}")
                continue

            # Aplicar factor de escala
            valor_raw = resultado.registers[0]
            valor = valor_raw * config["factor"]

            # Enviar a la API
            payload = {
                "sensorId": config["sensorId"],
                "value": round(valor, 2),
                "timestamp": time.strftime(
                    "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                ),
                "source": "modbus"
            }
            response = requests.post(
                API_URL, json=payload, headers=headers, timeout=5
            )
            print(f"✓ {config['tipo']}: {valor:.1f} "
                  f"(status={response.status_code})")

        except Exception as e:
            print(f"✗ Error registro {registro}: {e}")

# Bucle principal
if __name__ == "__main__":
    client = ModbusTcpClient(MODBUS_HOST, port=MODBUS_PORT)
    client.connect()

    print("🚀 Gateway Modbus iniciado...")

    try:
        while True:
            leer_y_enviar(client)
            time.sleep(5)  # Intervalo de lectura
    except KeyboardInterrupt:
        client.close()
        print("Gateway detenido.")`} />

          <InfoBox type="info">
            Para <strong>Modbus RTU</strong> (serial RS-485), reemplace <code className="font-mono text-xs">ModbusTcpClient</code> por <code className="font-mono text-xs">ModbusSerialClient</code> con los parámetros de puerto serial (<code className="font-mono text-xs">port=&apos;/dev/ttyUSB0&apos;</code>, <code className="font-mono text-xs">baudrate=9600</code>).
          </InfoBox>

          <SubTitle>2.3 MQTT (Vía Message Broker)</SubTitle>
          <Paragraph>
            Para entornos con alta frecuencia de datos o redes de bajo ancho de banda, MQTT es ideal. Se necesita un <strong>broker MQTT</strong> (ej: Mosquitto, EMQX) y un <strong>puente suscriptor</strong> que convierta los mensajes MQTT en llamadas a la API de ingest.
          </Paragraph>

          <CodeBlock language="diagram — Arquitectura MQTT" code={`┌──────────────┐    MQTT Publish    ┌──────────────────┐
│  Sensores     │───────────────────►│  Broker MQTT     │
│  IoT          │   (QoS 1/2)       │  (Mosquitto/     │
│               │                    │   EMQX/AWS IoT)  │
│  ESP32        │                    └────────┬─────────┘
│  Arduino      │                             │ MQTT Subscribe
│  Industrial   │                             ▼
└──────────────┘                    ┌──────────────────┐
                                    │  Puente MQTT →   │
                                    │  API (Subscriber)│
                                    └────────┬─────────┘
                                             │ HTTP POST
                                             ▼
                                    ┌──────────────────┐
                                    │  API Ingest      │
                                    │  /api/sensors/   │
                                    │  ingest          │
                                    └──────────────────┘`} />

          <CodeBlock language="python — Puente MQTT (usando paho-mqtt)" code={`# mqtt_bridge.py — Suscriptor MQTT que reenvía datos a la API
import paho.mqtt.client as mqtt
import requests
import json
import ssl

# Configuración MQTT
MQTT_BROKER = "mqtt.su-servidor.com"
MQTT_PORT = 8883   # TLS
MQTT_TOPIC = "scada/sensores/#"  # Wildcard para todos los sensores
MQTT_USER = "bridge_user"
MQTT_PASS = "bridge_password"

# Configuración API
API_URL = "https://su-plataforma.com/api/sensors/ingest"
API_KEY = "su-api-key-aqui"
JWT_TOKEN = "your-jwt-token"

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {JWT_TOKEN}",
    "X-API-Key": API_KEY
}

def on_connect(client, userdata, flags, reason_code):
    print(f"✓ Conectado al broker (código: {reason_code})")
    client.subscribe(MQTT_TOPIC, qos=1)
    print(f"✓ Suscrito a: {MQTT_TOPIC}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())

        # El topic indica el sensorId:
        # scada/sensores/{sensorId}
        sensor_id = msg.topic.split("/")[-1]

        api_payload = {
            "sensorId": sensor_id,
            "value": float(payload.get("value", 0)),
            "timestamp": payload.get("timestamp"),
            "source": "mqtt",
            "metadata": {
                "topic": msg.topic,
                "qos": msg.qos,
                "retain": msg.retain
            }
        }

        response = requests.post(
            API_URL,
            json=api_payload,
            headers=HEADERS,
            timeout=5
        )

        if response.ok:
            print(f"✓ {sensor_id}: {api_payload['value']} → {response.status_code}")
        else:
            print(f"✗ {sensor_id}: Error {response.status_code}")

    except json.JSONDecodeError:
        print(f"⚠ Payload inválido en topic: {msg.topic}")
    except Exception as e:
        print(f"✗ Error procesando mensaje: {e}")

# Iniciar cliente MQTT
client = mqtt.Client(
    mqtt.CallbackAPIVersion.VERSION2,
    client_id="scada_bridge_01"
)
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.tls_set()  # TLS para seguridad
client.on_connect = on_connect
client.on_message = on_message

print("🚀 Conectando al broker MQTT...")
client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
client.loop_forever()`} />

          <CodeBlock language="json — Formato del mensaje MQTT" code={`// Topic: scada/sensores/clxxxxx...sensor-presion
{
  "value": 72.4,
  "timestamp": "2025-01-15T14:30:00Z",
  "quality": 100,
  "unit": "psi"
}`} />

          <SubTitle>2.4 OPC-UA (Protocolo Industrial)</SubTitle>
          <Paragraph>
            Para integraciones con sistemas SCADA/DCS existentes que exponen datos vía OPC-UA, se requiere un <strong>cliente OPC-UA</strong> que se suscriba a los nodos deseados y publique las lecturas en la API.
          </Paragraph>

          <CodeBlock language="diagram — Arquitectura OPC-UA" code={`┌──────────────┐    OPC-UA          ┌──────────────────┐
│  PLC / DCS    │◄──────────────────►│  Servidor        │
│  (Siemens,    │   (TCP 4840)       │  OPC-UA          │
│   Allen-      │                    │  (open62541 /    │
│   Bradley)    │                    │   Prosys)        │
└──────────────┘                    └────────┬─────────┘
                                             │ Subscribe
                                             ▼
                                    ┌──────────────────┐
                                    │  Cliente OPC-UA  │
                                    │  → Puente HTTP   │
                                    └────────┬─────────┘
                                             │ POST
                                             ▼
                                    ┌──────────────────┐
                                    │  API Ingest      │
                                    └──────────────────┘`} />

          <CodeBlock language="python — Cliente OPC-UA (usando asyncua)" code={`# opcua_bridge.py — Cliente OPC-UA que envía datos a la API
import asyncio
import requests
from asyncua import Client

# Configuración OPC-UA
OPCUA_URL = "opc.tcp://192.168.1.200:4840"
API_URL = "https://su-plataforma.com/api/sensors/ingest"
API_KEY = "su-api-key-aqui"
JWT_TOKEN = "your-jwt-token"
POLL_INTERVAL = 3  # Segundos entre lecturas

# Mapeo de nodos OPC-UA → Sensores en la plataforma
# Formato: { "node_id": "sensorId_en_plataforma" }
MAPEO_NODOS = {
    "ns=2;s=Presion.LineaPrincipal": "clxxxxx...sensor-presion",
    "ns=2;s=Temperatura.SalaControl": "clxxxxx...sensor-temp",
    "ns=2;s=Gas.Detector_ZonaA": "clxxxxx...sensor-gas",
    "ns=2;s=Voltaje.Tablero_Principal": "clxxxxx...sensor-volt",
}

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {JWT_TOKEN}",
    "X-API-Key": API_KEY
}

async def monitorear_nodos(client: Client):
    """Suscribe a cambios en los nodos OPC-UA y envía a la API."""
    for node_id, sensor_id in MAPEO_NODOS.items():
        node = client.get_node(node_id)

        # Definir handler para cambios de valor
        def crear_handler(sid):
            async def handler(data):
                try:
                    valor = data.value.Value.Value
                    if valor is None:
                        return

                    payload = {
                        "sensorId": sid,
                        "value": float(valor),
                        "timestamp": data.value.SourceTimestamp.isoformat(),
                        "source": "opcua",
                        "metadata": {
                            "nodeId": node_id,
                            "quality": str(data.value.Status.Code)
                        }
                    }

                    # Enviar a la API (síncrono dentro del async)
                    response = requests.post(
                        API_URL, json=payload, headers=HEADERS, timeout=5
                    )
                    if response.ok:
                        print(f"✓ {sid}: {valor:.1f}")
                    else:
                        print(f"✗ {sid}: Error {response.status_code}")

                except Exception as e:
                    print(f"✗ Error en handler: {e}")

            return handler

        # Suscribirse al nodo
        handler = crear_handler(sensor_id)
        sub = await node.subscribe_data_change(handler)
        print(f"✓ Suscrito a: {node_id}")

    # Mantener vivo
    while True:
        await asyncio.sleep(POLL_INTERVAL)

async def main():
    print("🚀 Conectando al servidor OPC-UA...")
    async with Client(OPCUA_URL) as client:
        print("✓ Conectado al servidor OPC-UA")
        await monitorear_nodos(client)

if __name__ == "__main__":
    asyncio.run(main())`} />

          <InfoBox type="warning">
            Para entornos de producción, considere usar <strong>certificados TLS</strong> en todas las comunicaciones (HTTPS, MQTTS, OPC-UA con seguridad). Nunca exponga los endpoints de ingest en redes no cifradas.
          </InfoBox>

          {/* Tabla comparativa */}
          <SubTitle>Comparativa de Métodos de Integración</SubTitle>
          <SpecTable
            headers={['Método', 'Latencia', 'Complejidad', 'Ancho de Banda', 'Mejor Para']}
            rows={[
              ['HTTP Webhook', 'Media (~100ms)', 'Baja', 'Medio', 'IoT WiFi, sensores modernos'],
              ['Modbus TCP/RTU', 'Baja (~10ms)', 'Media', 'Bajo', 'Sensores industriales RS-485'],
              ['MQTT', 'Muy baja (~5ms)', 'Media-Alta', 'Muy bajo', 'Alta frecuencia, redes limitadas'],
              ['OPC-UA', 'Baja (~20ms)', 'Alta', 'Medio', 'Integración con PLC/DCS'],
            ]}
          />
        </Section>

        {/* ============================================================
            SECCIÓN 3: REFERENCIA DE API
            ============================================================ */}
        <Section
          id="api-reference"
          title="3. Referencia de API — Endpoints"
          icon={<Code className="w-4 h-4" />}
          badge="REST"
        >
          <Paragraph>
            Todos los endpoints de la API REST siguen el patrón <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">/api/sensors/*</code> y requieren autenticación JWT. Los endpoints de ingest externos adicionalmente aceptan API Keys vía header.
          </Paragraph>

          <InfoBox type="info">
            <strong>URL Base:</strong> <code className="font-mono text-xs">https://su-plataforma.com/api</code> — Todos los endpoints listados son relativos a esta URL base.
          </InfoBox>

          {/* POST /api/sensors/ingest */}
          <SubTitle>POST /api/sensors/ingest — Ingestar Lectura de Sensor</SubTitle>
          <Paragraph>
            Recibe una lectura individual de un sensor físico. Actualiza el valor actual del sensor, crea un registro histórico (SensorReading), y evalúa el estado contra los umbrales configurados. Retorna el estado calculado (NORMAL/WARNING/CRITICO).
          </Paragraph>

          <SpecTable
            headers={['Parámetro', 'Tipo', 'Requerido', 'Descripción']}
            rows={[
              ['sensorId', 'string', 'Sí', 'ID único del sensor registrado'],
              ['value', 'number', 'Sí', 'Valor numérico de la lectura'],
              ['timestamp', 'string (ISO 8601)', 'No', 'Informativo (el servidor genera su propio timestamp de almacenamiento)'],
              ['source', 'string', 'No', 'Origen: "webhook", "mqtt", "manual"'],
              ['metadata', 'object', 'No', 'Datos adicionales (quality, nodeId, topic, etc.)'],
            ]}
          />

          <CodeBlock language="Request — POST /api/sensors/ingest" code={`POST /api/sensors/ingest HTTP/1.1
Host: su-plataforma.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-API-Key: ech_live_xxxxxxxxxxxxxxxxxxxx

{
  "sensorId": "clp1234567890abcdefghij",
  "value": 85.7,
  "timestamp": "2025-01-15T14:30:00.000Z",
  "source": "modbus",
  "metadata": {
    "register": 1,
    "unit": "psi",
    "quality": "good"
  }
}`} />

          <CodeBlock language="Response — 200 OK" code={`{
  "success": true,
  "sensorId": "clp1234567890abcdefghij",
  "sensorName": "Presión Línea Principal A",
  "value": 85.7,
  "unit": "psi",
  "status": "WARNING",
  "thresholdCritical": 100,
  "thresholdWarning": 80,
  "isSimulated": false,
  "timestamp": "2025-01-15T14:30:00.000Z"
}`} />

          <CodeBlock language="Response — 400 Bad Request (errores de validación)" code={`{
  "success": false,
  "error": "sensorId es requerido"
}`} />

          <CodeBlock language="Response — 404 Not Found" code={`{
  "success": false,
  "error": "Sensor no encontrado o inactivo"
}`} />

          {/* GET /api/sensors/telemetry */}
          <SubTitle>GET /api/sensors/telemetry — Obtener Telemetría Completa</SubTitle>
          <Paragraph>
            Retorna todos los puntos de telemetría activos de la compañía del usuario autenticado. Si el modo demo está activado, ejecuta un tick de simulación antes de retornar los datos. Incluye el estado global de seguridad del sitio.
          </Paragraph>

          <CodeBlock language="Response — 200 OK" code={`{
  "points": [
    {
      "sensorId": "clp1234567890abcdefghij",
      "sensorName": "Presión Línea Principal A",
      "type": "PRESION",
      "value": 72.4,
      "unit": "psi",
      "status": "NORMAL",
      "thresholdCritical": 100,
      "thresholdWarning": 80,
      "isSimulated": true,
      "timestamp": "2025-01-15T14:30:00.000Z"
    },
    {
      "sensorId": "clp0987654321zyxwvutsrq",
      "sensorName": "Temperatura Sala Control",
      "type": "TEMPERATURA",
      "value": 82.1,
      "unit": "°C",
      "status": "WARNING",
      "thresholdCritical": 90,
      "thresholdWarning": 78,
      "isSimulated": true,
      "timestamp": "2025-01-15T14:30:00.000Z"
    }
  ],
  "siteSafety": {
    "isSafe": true,
    "criticalSensors": [],
    "warningSensors": [
      {
        "id": "clp0987654321zyxwvutsrq",
        "name": "Temperatura Sala Control",
        "type": "TEMPERATURA",
        "value": 82.1,
        "unit": "°C"
      }
    ]
  },
  "demoMode": true,
  "timestamp": "2025-01-15T14:30:00.000Z"
}`} />

          {/* POST /api/sensors */}
          <SubTitle>POST /api/sensors — Registrar Nuevo Sensor</SubTitle>
          <Paragraph>
            Crea un nuevo sensor en el sistema. Al registrarlo, se le asignan automáticamente los umbrales por defecto según el tipo de sensor. El sensor se marca como simulado por defecto; para conectar un sensor real, actualice este campo después del registro.
          </Paragraph>

          <CodeBlock language="Request — POST /api/sensors" code={`POST /api/sensors HTTP/1.1
Host: su-plataforma.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "name": "Presión Compresor Etapa 2",
  "type": "PRESION",
  "locationId": "clloc1234567890",
  "unit": "psi",
  "thresholdCritical": 120,
  "thresholdWarning": 95
}`} />

          <CodeBlock language="Response — 201 Created" code={`{
  "id": "clp_new_sensor_abc123",
  "name": "Presión Compresor Etapa 2",
  "type": "PRESION",
  "unit": "psi",
  "thresholdCritical": 120,
  "thresholdWarning": 95,
  "isSimulated": true,
  "isActive": true,
  "currentValue": null,
  "lastReadingAt": null,
  "createdAt": "2025-01-15T14:30:00.000Z"
}`} />

          <InfoBox type="tip">
            Si no especifica <code className="font-mono text-xs">unit</code>, <code className="font-mono text-xs">thresholdCritical</code> ni <code className="font-mono text-xs">thresholdWarning</code>, se aplican los valores por defecto del perfil del tipo de sensor (ver Sección 6).
          </InfoBox>

          {/* PUT /api/sensors/[id] */}
          <SubTitle>PUT /api/sensors/[id] — Actualizar Configuración del Sensor</SubTitle>
          <Paragraph>
            Actualiza la configuración de un sensor existente. Útil para modificar umbrales, marcar como sensor real (isSimulated: false), asignar ubicación, o desactivar el sensor.
          </Paragraph>

          <CodeBlock language="Request — PUT /api/sensors/[id]" code={`PUT /api/sensors/clp1234567890abcdefghij HTTP/1.1
Host: su-plataforma.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "name": "Presión Línea Principal A (Actualizado)",
  "thresholdCritical": 110,
  "thresholdWarning": 85,
  "isSimulated": false,
  "isActive": true,
  "locationId": "clloc_new_location"
}`} />

          <CodeBlock language="Response — 200 OK" code={`{
  "id": "clp1234567890abcdefghij",
  "name": "Presión Línea Principal A (Actualizado)",
  "type": "PRESION",
  "unit": "psi",
  "thresholdCritical": 110,
  "thresholdWarning": 85,
  "isSimulated": false,
  "isActive": true,
  "currentValue": 72.4,
  "lastReadingAt": "2025-01-15T14:30:00.000Z"
}`} />

          {/* GET /api/sensors/[id]/readings */}
          <SubTitle>GET /api/sensors/[id]/readings — Lecturas Históricas</SubTitle>
          <Paragraph>
            Retorna las últimas N lecturas históricas de un sensor. Usado para gráficos de tendencia en el frontend.
          </Paragraph>

          <SpecTable
            headers={['Query Param', 'Tipo', 'Default', 'Descripción']}
            rows={[
              ['limit', 'number', '60', 'Máximo de lecturas a retornar'],
            ]}
          />

          <CodeBlock language="Response — 200 OK" code={`[
  { "value": 70.2, "status": "NORMAL", "timestamp": "2025-01-15T14:28:00.000Z" },
  { "value": 71.5, "status": "NORMAL", "timestamp": "2025-01-15T14:28:03.000Z" },
  { "value": 72.4, "status": "NORMAL", "timestamp": "2025-01-15T14:28:06.000Z" },
  { "value": 85.7, "status": "WARNING", "timestamp": "2025-01-15T14:28:09.000Z" },
  { "value": 102.3, "status": "CRITICO", "timestamp": "2025-01-15T14:28:12.000Z" }
]`} />

          {/* GET /api/sensors/site-safe */}
          <SubTitle>GET /api/sensors/site-safe — Verificación de Seguridad (Safety Gate)</SubTitle>
          <Paragraph>
            Verifica si el sitio de la compañía está en estado seguro. Retorna una bandera <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">isSafe</code> que el sistema de aprobaciones consulta para bloquear firmas de permisos cuando hay sensores en estado CRÍTICO.
          </Paragraph>

          <CodeBlock language="Response — 200 OK (sitio seguro)" code={`{
  "isSafe": true,
  "criticalSensors": [],
  "warningSensors": [
    {
      "id": "clp0987654321",
      "name": "Temperatura Sala Control",
      "type": "TEMPERATURA",
      "value": 82.1,
      "unit": "°C"
    }
  ]
}`} />

          <CodeBlock language="Response — 200 OK (sitio NO seguro)" code={`{
  "isSafe": false,
  "criticalSensors": [
    {
      "id": "clp_gas_detector",
      "name": "Gas Detector Zona A",
      "type": "GAS",
      "value": 6.2,
      "unit": "%LEL",
      "threshold": 5.0
    }
  ],
  "warningSensors": []
}`} />

          {/* POST /api/sensors/simulation */}
          <SubTitle>POST /api/sensors/simulation — Configurar Modo Demo</SubTitle>
          <Paragraph>
            Configura explícitamente el modo de simulación para la compañía del usuario enviando <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">{'{'} "enabled": true/false {'}'}  </code>. No es un toggle automático — debe especificarse el valor deseado. El estado se persiste en la base de datos. Requiere rol ADMIN, SUPERVISOR o MANAGER.
          </Paragraph>

          <CodeBlock language="Request" code={`POST /api/sensors/simulation HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "enabled": false
}`} />

          <CodeBlock language="Response — 200 OK" code={`{
  "demoMode": false,
  "message": "Modo demo desactivado. Se esperan datos reales."
}`} />

          {/* ── API Keys Endpoints (NEW in v3.0) ── */}
          <SubTitle>3.x API Keys — Gestión de Credenciales</SubTitle>
          <Paragraph>
            Endpoints dedicados para la creación, listado y revocación de API Keys. Las API Keys son la forma recomendada de autenticar integraciones de sensores y gateways externos de forma permanente.
          </Paragraph>

          <SubTitle>POST /api/api-keys — Crear Nueva Credencial API</SubTitle>
          <Paragraph>
            Genera una nueva API Key para la compañía del usuario autenticado. La clave completa solo se muestra una vez al momento de la creación.
          </Paragraph>

          <CodeBlock language="Request — POST /api/api-keys" code={`POST /api/api-keys HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "name": "Gateway Planta Norte",
  "permissions": "write",
  "expiresInDays": 90
}`} />

          <SpecTable
            headers={['Parámetro', 'Tipo', 'Requerido', 'Descripción']}
            rows={[
              ['name', 'string', 'Sí', 'Nombre descriptivo para la clave'],
              ['permissions', 'string', 'No', 'Nivel: "read", "write", o "admin" (default: "write")'],
              ['expiresInDays', 'number', 'No', 'Días hasta expiración (null = sin expiración)'],
            ]}
          />

          <CodeBlock language="Response — 201 Created" code={`{
  "success": true,
  "id": "clkey_abc123...",
  "name": "Gateway Planta Norte",
  "prefix": "ech_live_a1b2c3d4",
  "key": "ech_live_a1b2c3d4e5f6789012345678901234ab",
  "permissions": "write",
  "expiresAt": "2025-04-15T00:00:00.000Z",
  "createdAt": "2025-01-15T14:30:00.000Z"
}`} />

          <InfoBox type="warning">
            La clave completa (<code className="font-mono text-xs">key</code>) solo se muestra en la respuesta de creación. En futuras consultas (GET), solo se mostrará el <code className="font-mono text-xs">prefix</code>. Guarde la clave en un lugar seguro.
          </InfoBox>

          <SubTitle>GET /api/api-keys — Listar Credenciales Activas</SubTitle>
          <Paragraph>
            Retorna todas las API Keys activas (no expiradas y no revocadas) de la compañía del usuario.
          </Paragraph>

          <CodeBlock language="Response — 200 OK" code={`{
  "success": true,
  "keys": [
    {
      "id": "clkey_abc123...",
      "name": "Gateway Planta Norte",
      "prefix": "ech_live_a1b2c3d4",
      "permissions": "write",
      "expiresAt": "2025-04-15T00:00:00.000Z",
      "lastUsedAt": "2025-01-15T12:30:00.000Z",
      "createdAt": "2025-01-15T14:30:00.000Z"
    },
    {
      "id": "clkey_def456...",
      "name": "Sensor Gas Zona A",
      "prefix": "ech_live_x9y8z7w6",
      "permissions": "read",
      "expiresAt": null,
      "lastUsedAt": null,
      "createdAt": "2025-01-10T09:00:00.000Z"
    }
  ]
}`} />

          <SubTitle>DELETE /api/api-keys/['id'] — Revocar Credencial</SubTitle>
          <Paragraph>
            Revoca permanentemente una API Key. Las peticiones futuras con esa clave devolverán 401. Soporta el query parameter <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">?permanent=true</code> para eliminación definitiva.
          </Paragraph>

          <CodeBlock language="Request — DELETE /api/api-keys/[id]" code={`DELETE /api/api-keys/clkey_abc123... HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`} />

          <CodeBlock language="Response — 200 OK" code={`{
  "success": true,
  "message": "API Key revocada correctamente",
  "revokedKeyId": "clkey_abc123..."
}`} />

          <CodeBlock language="Response — 404 Not Found" code={`{
  "success": false,
  "error": "API Key no encontrada o ya revocada"
}`} />

          {/* ── Geofence Verification (NEW in v3.0) ── */}
          <SubTitle>3.x Aprobación/Rechazo de Permisos — Geofence GPS</SubTitle>
          <Paragraph>
            El endpoint <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">POST /api/permits/[id]/approve</code> maneja tanto la <strong>aprobación</strong> como el <strong>rechazo</strong> de permisos mediante el campo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">action: "approve" | "reject"</code>. Verifica automáticamente la ubicación GPS del supervisor contra el radio definido en la WorkLocation usando la fórmula de <strong>distancia Haversine</strong>. La geofence es de <strong>aplicación suave</strong>: si el supervisor está fuera del radio, puede aprobar/rechazar si proporciona una justificación (mínimo 10 caracteres).
          </Paragraph>

          <CodeBlock language="typescript — Algoritmo Haversine (src/lib/gps.ts)" code={`/**
 * Calcula la distancia en metros entre dos coordenadas GPS
 * usando la fórmula de Haversine.
 */
function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * Verifica si un punto GPS está dentro del radio de una geocerca.
 * Retorna { isInside, distanceMeters, effectiveRadius }
 */
function checkGeofence(
  pointLat: number, pointLon: number,
  centerLat: number, centerLon: number,
  radiusMeters: number
) {
  const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon)
  return {
    isInside: distance <= radiusMeters,
    distanceMeters: Math.round(distance),
    effectiveRadius: radiusMeters
  }
}`} />

          <SpecTable
            headers={['Campo del Request', 'Tipo', 'Descripción']}
            rows={[
              ['gpsLatitude', 'number', 'Latitud del supervisor al momento de la firma'],
              ['gpsLongitude', 'number', 'Longitud del supervisor al momento de la firma'],
              ['gpsAccuracy', 'number', 'Precisión GPS en metros (info para auditoría)'],
              ['approveJustification', 'string', 'Justificación cuando fuera de geocerca (mín. 10 chars)'],
              ['rejectGeofenceJustification', 'string', 'Justificación de rechazo fuera de geocerca (mín. 10 chars)'],
            ]}
          />

          <CodeBlock language="Response — Aprobación con geofence OK" code={`{
  "success": true,
  "permit": { ... },
  "geofence": {
    "isInside": true,
    "distanceMeters": 42,
    "effectiveRadius": 100
  }
}`} />

          <CodeBlock language="Response — 403 Fuera de geocerca (requiere justificación)" code={`{
  "success": false,
  "error": "GEOFENCE_JUSTIFICATION_REQUIRED",
  "message": "El supervisor está fuera de la geocerca. Se requiere justificación.",
  "geofence": {
    "isInside": false,
    "distanceMeters": 187,
    "effectiveRadius": 100
  }
}`} />

          <InfoBox type="tip">
            El radio efectivo se calcula como <code className="font-mono text-xs">WorkLocation.radius || permit.workRadius || 100</code> metros. Si la WorkLocation no tiene radio configurado, se usa el del permiso, y si tampoco tiene, se default a 100m.
          </InfoBox>
        </Section>

        {/* ============================================================
            SECCIÓN 4: FORMATOS DE DATOS
            ============================================================ */}
        <Section
          id="formatos-datos"
          title="4. Especificación de Formatos de Datos"
          icon={<Database className="w-4 h-4" />}
          badge="JSON"
        >
          <Paragraph>
            Todos los endpoints de la API utilizan <strong>JSON</strong> como formato de intercambio de datos. A continuación se documentan los payloads exactos para cada método de integración.
          </Paragraph>

          <SubTitle>4.1 Payload de Ingesta (Webhook Directo)</SubTitle>
          <CodeBlock language="json — Payload mínimo para ingest" code={`{
  "sensorId": "clp1234567890abcdefghij",   // Requerido: ID del sensor
  "value": 72.4                              // Requerido: valor numérico
}`} />

          <CodeBlock language="json — Payload completo con metadatos" code={`{
  "sensorId": "clp1234567890abcdefghij",
  "value": 72.4,
  "timestamp": "2025-01-15T14:30:00.000Z",  // ISO 8601 UTC (opcional)
  "source": "webhook",                        // "webhook"|"mqtt"|"modbus"|"opcua"
  "metadata": {                               // Objeto libre (opcional)
    "deviceId": "SENSOR-P-001",
    "batteryLevel": 87,
    "signalStrength": -42,
    "firmware": "v2.3.1"
  }
}`} />

          <SubTitle>4.2 Payload de Ingesta Batch (Múltiples sensores)</SubTitle>
          <CodeBlock language="json — Lecturas múltiples en un solo request" code={`{
  "readings": [
    {
      "sensorId": "clp_sensor_presion",
      "value": 72.4,
      "timestamp": "2025-01-15T14:30:00.000Z",
      "source": "modbus"
    },
    {
      "sensorId": "clp_sensor_temperatura",
      "value": 65.2,
      "timestamp": "2025-01-15T14:30:00.000Z",
      "source": "modbus"
    },
    {
      "sensorId": "clp_sensor_gas",
      "value": 1.8,
      "timestamp": "2025-01-15T14:30:00.000Z",
      "source": "modbus"
    },
    {
      "sensorId": "clp_sensor_voltaje",
      "value": 219.5,
      "timestamp": "2025-01-15T14:30:00.000Z",
      "source": "modbus"
    }
  ]
}`} />

          <SubTitle>4.3 Formato de Registro de Sensor</SubTitle>
          <CodeBlock language="json — Crear nuevo sensor" code={`{
  "name": "Presión Compresor Etapa 2",       // Requerido
  "type": "PRESION",                          // PRESION|TEMPERATURA|GAS|VOLTAJE
  "locationId": "clloc1234567890",            // Opcional: ubicación
  "unit": "psi",                              // Opcional: auto por tipo
  "thresholdCritical": 120,                  // Opcional: auto por perfil
  "thresholdWarning": 95                     // Opcional: auto por perfil
}`} />

          <SubTitle>4.4 Formato de Actualización de Sensor</SubTitle>
          <CodeBlock language="json — Actualizar sensor (PUT)" code={`{
  "name": "Nuevo nombre",           // Opcional
  "thresholdCritical": 150,         // Opcional
  "thresholdWarning": 120,          // Opcional
  "isSimulated": false,             // Marcar como sensor REAL
  "isActive": true,                 // Activar/desactivar
  "locationId": "clloc_nueva_loc"   // Reasignar ubicación
}`} />

          <SubTitle>4.5 Formato de Respuesta de Telemetría</SubTitle>
          <CodeBlock language="json — Estructura del objeto TelemetryPoint" code={`{
  "sensorId": "clp1234567890abcdefghij",  // ID del sensor
  "sensorName": "Presión Línea A",         // Nombre legible
  "type": "PRESION",                       // Tipo de sensor
  "value": 72.4,                           // Valor actual
  "unit": "psi",                           // Unidad de medida
  "status": "NORMAL",                      // NORMAL|WARNING|CRITICO
  "thresholdCritical": 100,                // Umbral crítico
  "thresholdWarning": 80,                  // Umbral advertencia
  "isSimulated": true,                     // ¿Proviene de simulación?
  "timestamp": "2025-01-15T14:30:00.000Z"  // ISO 8601
}`} />

          <SubTitle>4.6 Formato de Respuesta de Seguridad</SubTitle>
          <CodeBlock language="json — Estructura SiteSafetyCheck" code={`{
  "isSafe": false,                          // true = sitio seguro
  "criticalSensors": [                      // Lista de sensores críticos
    {
      "id": "clp_gas_detector",
      "name": "Gas Detector Zona A",
      "type": "GAS",
      "value": 6.2,
      "unit": "%LEL",
      "threshold": 5.0                      // Su umbral crítico
    }
  ],
  "warningSensors": [                       // Lista de sensores en advertencia
    {
      "id": "clp_temp_sensor",
      "name": "Temperatura Sala Control",
      "type": "TEMPERATURA",
      "value": 82.1,
      "unit": "°C"
    }
  ]
}`} />

          <InfoBox type="info">
            El campo <code className="font-mono text-xs">metadata</code> en el payload de ingest es un objeto libre que no se valida estructuralmente. Se puede utilizar para transportar cualquier dato adicional del sensor (nivel de batería, intensidad de señal, ID de dispositivo, etc.).
          </InfoBox>
        </Section>

        {/* ============================================================
            SECCIÓN 5: REGISTRO DE SENSORES
            ============================================================ */}
        <Section
          id="registro-sensor"
          title="5. Registro de Sensores Físicos"
          icon={<Cpu className="w-4 h-4" />}
          badge="Guía Paso a Paso"
        >
          <Paragraph>
            Para integrar un sensor físico real al sistema, siga estos pasos. El proceso consta de 3 fases: preparación, registro en la plataforma, y configuración del método de envío.
          </Paragraph>

          <SubTitle>Fase 1: Preparación</SubTitle>
          <StepList
            steps={[
              'Identifique el tipo de sensor: PRESION (psi), TEMPERATURA (°C), GAS (%LEL), o VOLTAJE (V).',
              'Verifique los rangos de operación del sensor y los umbrales de alarma recomendados por el fabricante.',
              'Determine el método de integración: HTTP Webhook, Modbus, MQTT, u OPC-UA.',
              'Asegúrese de tener conectividad de red entre el sensor (o gateway) y la plataforma.',
              'Obtenga un token JWT y una API Key válidos para autenticación.',
            ]}
          />

          <SubTitle>Fase 2: Registro en la Plataforma</SubTitle>
          <StepList
            steps={[
              'Inicie sesión en la plataforma con credenciales de ADMIN o SUPERVISOR.',
              'Navegue al módulo SCADA → Tab "Telemetría".',
              'Haga clic en el botón "Sensor" para abrir el diálogo de creación.',
              'Complete el nombre del sensor (ej: "Presión Compresor Etapa 2").',
              'Seleccione el tipo de sensor correcto.',
              'Asigne una ubicación si el sensor está vinculado a un lugar de trabajo.',
              'Haga clic en "Crear Sensor". El sistema asignará umbrales por defecto.',
              'Copie el ID del sensor generado (se usará para enviar lecturas).',
            ]}
          />

          <SubTitle>Fase 3: Configurar el Sensor como Real</SubTitle>
          <Paragraph>
            Después de registrar el sensor, se crea en modo <strong>simulado</strong> por defecto. Debe marcarlo como sensor real para que el sistema espere datos externos en lugar de generar simulaciones.
          </Paragraph>
          <CodeBlock language="bash — Marcar sensor como real (vía API)" code={`curl -X PUT https://su-plataforma.com/api/sensors/clp1234567890 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "isSimulated": false
  }'

# Respuesta:
# { "isSimulated": false, "name": "Presión Compresor Etapa 2", ... }`} />

          <SubTitle>Fase 4: Configurar el Envío de Datos</SubTitle>
          <Paragraph>
            Implemente el código de envío según el método elegido en la Sección 2. Asegúrese de usar el <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">sensorId</code> obtenido en el paso 2 y de incluir los headers de autenticación en cada petición.
          </Paragraph>

          <CodeBlock language="bash — Verificar que el sensor recibe datos" code={`# Consultar el estado actual del sensor
curl -s https://su-plataforma.com/api/sensors/telemetry \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq

# Buscar su sensor por nombre y verificar:
# - "value": tiene un valor numérico (no null)
# - "isSimulated": false
# - "timestamp": es reciente (últimos 10 segundos)`} />

          <SubTitle>Vía Interfaz Gráfica (UI)</SubTitle>
          <StepList
            steps={[
              'Alternativamente, desactive el modo demo (toggle "Modo Demo" → OFF).',
              'El sistema detendrá la simulación para todos los sensores marcados como isSimulated=false.',
              'Los sensores reales comenzarán a mostrar datos cuando el endpoint de ingest reciba lecturas.',
              'Si un sensor real no recibe datos, mostrará "Sin datos" y su LED permanecerá gris.',
            ]}
          />

          <InfoBox type="warning">
            Al desactivar el modo demo, los sensores que siguen marcados como <code className="font-mono text-xs">isSimulated: true</code> dejarán de actualizarse automáticamente. Asegúrese de que todos sus sensores físicos estén configurados correctamente antes de desactivar la simulación.
          </InfoBox>

          <SubTitle>5.4 Importación Masiva de Sensores</SubTitle>
          <Paragraph>
            Para registrar grandes volúmenes de sensores de forma eficiente, el sistema ofrece un endpoint de importación masiva vía <strong>CSV o XLSX</strong>. El sistema soporta alias de columnas en español e inglés para facilitar la migración desde diferentes fuentes.
          </Paragraph>

          <CodeBlock language="Request — POST /api/v1/import/sensors" code={`POST /api/v1/import/sensors HTTP/1.1
Content-Type: multipart/form-data
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

--boundary
Content-Disposition: form-data; name="file"; filename="sensores.csv"
Content-Type: text/csv

nombre,tipo,ubicacion,unidad,critico,advertencia
Presión Compresor 1,PRESION,Planta Norte,psi,120,95
Temp. Sala Control,TEMPERATURA,Planta Norte,°C,90,78
Gas Zona A,GAS,Planta Sur,%LEL,5.0,3.5
Voltaje Principal,VOLTAJE,Planta Norte,V,250,240
--boundary--`} />

          <SubTitle>Alias de Columnas Soportados</SubTitle>
          <SpecTable
            headers={['Campo', 'Alias Soportados', 'Requerido', 'Default']}
            rows={[
              ['Nombre', 'name / nombre / sensor', 'Sí', '—'],
              ['Tipo', 'type / tipo', 'Sí', 'PRESION'],
              ['Ubicación', 'location / ubicación', 'No', 'Sin ubicación'],
              ['Unidad', 'unit / unidad', 'No', 'Según tipo'],
              ['Umbral Crítico', 'threshold_critical / critico', 'No', 'Según perfil'],
              ['Umbral Advertencia', 'threshold_warning / advertencia', 'No', '0'],
            ]}
          />

          <SubTitle>Lógica Upsert</SubTitle>
          <Paragraph>
            La importación utiliza una estrategia <strong>upsert</strong> basada en <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">nombre + companyId</code>:
          </Paragraph>
          <StepList
            steps={[
              'Si no existe un sensor con ese nombre en la misma compañía → se CREA.',
              'Si ya existe un sensor con ese nombre en la compañía → se ACTUALIZA (umbrales, tipo, ubicación).',
              'Filas con errores de validación se SKIPEAN individualmente (no falla toda la importación).',
              'Se procesan máximo 500 filas por petición.',
            ]}
          />

          <CodeBlock language="Response — 200 OK" code={`{
  "success": true,
  "created": 8,
  "updated": 3,
  "skipped": 0,
  "errors": [
    {
      "row": 12,
      "nombre": "Sensor Invalido",
      "error": "Tipo no reconocido: RADAR. Tipos válidos: PRESION, TEMPERATURA, GAS, VOLTAJE"
    }
  ]
}`} />

          <InfoBox type="tip">
            Puede descargar una <strong>plantilla XLSX de ejemplo</strong> directamente desde la UI (SCADA → Importar → "Descargar plantilla"). La plantilla incluye 4 filas de ejemplo con los encabezados correctos.
          </InfoBox>
        </Section>

        {/* ============================================================
            SECCIÓN 6: CONFIGURACIÓN DE UMBRALES
            ============================================================ */}
        <Section
          id="umbrales"
          title="6. Configuración de Umbrales de Seguridad"
          icon={<Settings className="w-4 h-4" />}
          badge="Safety Gates"
        >
          <Paragraph>
            Los umbrales determinan el estado de cada sensor (NORMAL, WARNING, CRITICO) y activan los Safety Gates que bloquean operaciones de firma de permisos. La evaluación se realiza automáticamente cada vez que se recibe una lectura.
          </Paragraph>

          <SubTitle>6.1 Lógica de Evaluación de Estado</SubTitle>
          <CodeBlock language="typescript — Función getSensorStatus() del motor SCADA" code={`/**
 * Evalúa el estado de un sensor según su valor y umbrales.
 * Implementada en: src/lib/scada/engine.ts
 */
function getSensorStatus(
  value: number,
  thresholdCritical: number,
  thresholdWarning: number
): "NORMAL" | "WARNING" | "CRITICO" {
  if (value >= thresholdCritical) return "CRITICO"
  if (thresholdWarning > 0 && value >= thresholdWarning) return "WARNING"
  return "NORMAL"
}

// Ejemplos de evaluación:
// value=72.4, crit=100, warn=80  → NORMAL
// value=85.0, crit=100, warn=80  → WARNING (>= 80)
// value=100.0, crit=100, warn=80 → CRITICO (>= 100)
// value=105.3, crit=100, warn=80 → CRITICO`} />

          <SubTitle>6.2 Perfiles por Defecto por Tipo de Sensor</SubTitle>
          <SpecTable
            headers={['Tipo', 'Base', 'Fluctuación', 'Umbral Warning', 'Umbral Crítico', 'Unidad']}
            rows={[
              ['PRESION', '45 psi', '±8 psi', '80 psi', '100 psi', 'psi'],
              ['TEMPERATURA', '65 °C', '±12 °C', '78 °C', '90 °C', '°C'],
              ['GAS', '1.5 %LEL', '±1.0 %LEL', '3.5 %LEL', '5.0 %LEL', '%LEL'],
              ['VOLTAJE', '220 V', '±15 V', '240 V', '250 V', 'V'],
            ]}
          />

          <SubTitle>6.3 Cómo Configurar Umbrales Personalizados</SubTitle>
          <CodeBlock language="bash — Configurar umbrales personalizados" code={`# Establecer umbrales estrictos para detector de gas
curl -X PUT https://su-plataforma.com/api/sensors/clp_gas_detector \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "thresholdWarning": 2.5,
    "thresholdCritical": 4.0
  }'

# Nota: thresholdWarning DEBE ser menor que thresholdCritical
# thresholdCritical DEBE ser mayor que 0`} />

          <InfoBox type="warning">
            Reglas de validación de umbrales:
            <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
              <li><code className="font-mono">thresholdCritical</code> debe ser un número positivo mayor a 0.</li>
              <li><code className="font-mono">thresholdWarning</code> debe ser no-negativo.</li>
              <li><code className="font-mono">thresholdWarning</code> debería ser menor que <code className="font-mono">thresholdCritical</code> (si warning &gt;= critical, WARNING nunca se activa).</li>
              <li>Si <code className="font-mono">thresholdWarning</code> es 0, el sensor solo tiene dos estados: NORMAL y CRITICO.</li>
            </ul>
          </InfoBox>

          <SubTitle>6.4 Safety Gates — Función de Interbloqueo</SubTitle>
          <Paragraph>
            Cuando un sensor alcanza estado <strong>CRÍTICO</strong>, el sistema activa un interbloqueo de seguridad que:
          </Paragraph>
          <StepList
            steps={[
              'Bloquea los botones de "Aprobar" y "Rechazar" en el Panel de Aprobaciones.',
              'Muestra un banner rojo de "ALERTA SCADA — SITIO NO SEGURO" en todo el sistema.',
              'El bloqueo afecta a TODAS las ubicaciones de la compañía (isCompanySafe).',
              'Solo se desbloquea cuando TODOS los sensores vuelven a estado NORMAL o WARNING.',
            ]}
          />

          <CodeBlock language="typescript — Verificación de seguridad" code={`// Función isCompanySafe() — Motor SCADA
// Verifica TODOS los sensores activos de la compañía

async function isCompanySafe(companyId: string): Promise<SiteSafetyCheck> {
  const sensors = await db.sensor.findMany({
    where: { companyId, isActive: true }
  })

  const criticalSensors = sensors
    .filter(s => getSensorStatus(
      s.currentValue ?? 0,
      s.thresholdCritical,
      s.thresholdWarning
    ) === 'CRITICO')

  return {
    isSafe: criticalSensors.length === 0,  // true si no hay críticos
    criticalSensors,
    warningSensors: sensors.filter(s =>
      getSensorStatus(s.currentValue ?? 0, ...) === 'WARNING'
    )
  }
}`} />

          <SubTitle>6.5 Zona de Seguridad Recomendada por Tipo</SubTitle>
          <SpecTable
            headers={['Tipo de Sensor', 'Zona Normal', 'Zona Advertencia', 'Zona Crítica', 'Riesgo Asociado']}
            rows={[
              ['PRESION', '0 – 80 psi', '80 – 100 psi', '> 100 psi', 'Ruptura de línea, explosión'],
              ['TEMPERATURA', '15 – 78 °C', '78 – 90 °C', '> 90 °C', 'Incinio, daño equipamiento'],
              ['GAS (%LEL)', '0 – 3.5%', '3.5 – 5.0%', '> 5.0%', 'Atmósfera explosiva (LEL)'],
              ['VOLTAJE', '180 – 240 V', '240 – 250 V', '> 250 V', 'Sobrecarga eléctrica, incendio'],
            ]}
          />
        </Section>

        {/* ============================================================
            SECCIÓN 7: AUTENTICACIÓN Y SEGURIDAD
            ============================================================ */}
        <Section
          id="autenticacion"
          title="7. Autenticación y Seguridad"
          icon={<Shield className="w-4 h-4" />}
          badge="Seguridad"
        >
          <Paragraph>
            Todos los endpoints de la API están protegidos por autenticación. Las integraciones externas de sensores aceptan dos métodos de autenticación: un token JWT (para sesiones de usuario) o una API Key (para dispositivos embebidos y gateways). Solo se necesita UNO de los dos.
          </Paragraph>

          <InfoBox type="info">
            <strong>¿Dónde obtengo las credenciales?</strong> Ve al módulo <strong>SCADA → Credenciales API</strong> en el panel principal. Ahí podrás ver y copiar tu token JWT, así como generar y gestionar API Keys.
          </InfoBox>

          <SubTitle>7.1 JWT (JSON Web Token) — Autenticación Custom</SubTitle>
          <Paragraph>
            La plataforma utiliza un sistema de autenticación JWT propio implementado con la librería <strong>jose</strong> (HS256). No utiliza NextAuth.js. El token se genera al <strong>iniciar sesión</strong> vía <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">POST /api/auth/login</code> y tiene una validez de 30 días. La verificación se realiza <strong>por ruta</strong> (no hay middleware global) — cada API handler llama a <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">getSession(request)</code> para validar el token.
          </Paragraph>

          <SubTitle>Endpoints de Autenticación</SubTitle>
          <SpecTable
            headers={['Endpoint', 'Método', 'Descripción']}
            rows={[
              ['/api/auth/login', 'POST', 'Inicio de sesión (email + password) → devuelve JWT'],
              ['/api/auth/register', 'POST', 'Registro de nuevo usuario'],
              ['/api/auth/token', 'POST', 'Validación y refresh de token'],
            ]}
          />

          <Paragraph>
            Para obtener y copiar tu token JWT desde la interfaz:
          </Paragraph>
          <StepList
            steps={[
              'Inicia sesión en la plataforma con tu email y contraseña.',
              'Ve al menú lateral y selecciona el módulo "SCADA".',
              'En la barra de pestañas del SCADA, haz clic en "Credenciales API".',
              'En la sección "Token JWT", haz clic en el botón "Copiar Token Completo".',
              'Pega este token en tus scripts o configuración de gateway.',
            ]}
          />
          <CodeBlock language="http — Header de autenticación JWT" code={`Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
              ↑ Prefijo "Bearer" + espacio + token completo`} />

          <InfoBox type="warning">
            El token JWT tiene una validez de <strong>30 días</strong>. Cuando expire, deberás iniciar sesión de nuevo y copiar el nuevo token. Para integraciones permanentes (dispositivos IoT, gateways), se recomienda usar <strong>API Keys</strong> en su lugar, ya que permiten expiración configurable.
          </InfoBox>

          <InfoBox type="tip">
            <strong>Implementación técnica:</strong> El JWT se firma con <code className="font-mono text-xs">SignJWT</code> de <code className="font-mono text-xs">jose</code> usando el algoritmo HS256 y el secreto configurado en <code className="font-mono text-xs">JWT_SECRET</code> (variable de entorno obligatoria). El payload incluye <code className="font-mono text-xs">userId</code>, <code className="font-mono text-xs">companyId</code>, <code className="font-mono text-xs">role</code> y <code className="font-mono text-xs">email</code>.
          </InfoBox>

          <SubTitle>7.2 API Key — Cómo generarla</SubTitle>
          <Paragraph>
            Las API Keys son credenciales estáticas diseñadas específicamente para dispositivos que no manejan sesiones de usuario (sensores IoT, gateways Modbus, puentes MQTT). Para generar una:
          </Paragraph>
          <StepList
            steps={[
              'Ve al módulo "SCADA" en el menú lateral.',
              'Haz clic en la pestaña "Credenciales API".',
              'Cambia a la sección "API Keys" (segundo botón toggle).',
              'Haz clic en "Nueva API Key".',
              'Asigna un nombre descriptivo (ej: "Gateway Planta Norte", "Sensor Gas Zona A").',
              'Selecciona la vigencia (30 días, 90 días, 6 meses, 1 año, o sin expiración).',
              'Haz clic en "Generar Clave".',
              'COPIA LA CLAVE COMPLETA inmediatamente — solo se muestra una vez.',
            ]}
          />
          <CodeBlock language="http — Header de API Key" code={`X-API-Key: ech_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
          ↑ Prefijo "ech_live_" + 32 caracteres aleatorios`} />

          <InfoBox type="warning">
            La clave completa <strong>solo se muestra una vez</strong> al momento de crearla. El sistema almacena únicamente un hash SHA-256 (nunca la clave en texto plano). Si pierdes la clave, deberás generar una nueva y revocar la anterior.
          </InfoBox>

          <SubTitle>7.2.1 Diferencias: JWT vs API Key</SubTitle>
          <SpecTable
            headers={['Característica', 'JWT Token', 'API Key']}
            rows={[
              ['Dónde obtenerlo', 'SCADA → Credenciales API → Token JWT', 'SCADA → Credenciales API → API Keys → Nueva'],
              ['Vigencia', '30 días (renovable al iniciar sesión)', 'Configurable: 30 días a 1 año, o sin expiración'],
              ['Almacenamiento servidor', 'Sin estado (stateless)', 'Solo hash SHA-256 (nunca texto plano)'],
              ['Uso recomendado', 'Pruebas manuales, scripts temporales', 'Dispositivos IoT, gateways, producción'],
              ['Máximo por empresa', '1 por usuario (al iniciar sesión)', '10 claves activas'],
              ['Revocación', 'Al cerrar sesión o expirar', 'Manual desde el panel (botón "Revocar")'],
              ['Header HTTP', 'Authorization: Bearer &lt;token&gt;', 'X-API-Key: ech_live_xxx...'],
            ]}
          />

          <SubTitle>7.3 Roles y Permisos</SubTitle>
          <SpecTable
            headers={['Rol', 'Ver Telemetría', 'Crear Sensor', 'Configurar Umbrales', 'Ingestar Datos']}
            rows={[
              ['ADMIN', '✓', '✓', '✓', '✓'],
              ['SUPERVISOR', '✓', '✓', '✓', '✓'],
              ['MANAGER', '✓', '✓', '✓', '✓'],
              ['OPERARIO', '✓', '✗', '✗', '✗'],
            ]}
          />

          <SubTitle>7.4 API Keys Management</SubTitle>
          <Paragraph>
            Las API Keys funcionan como un método de autenticación alternativo diseñado para integraciones automatizadas. Se pueden usar vía <strong>header HTTP</strong> o <strong>query parameter</strong>:
          </Paragraph>
          <CodeBlock language="http — Dos formas de enviar una API Key" code={`# Forma 1: Header HTTP (recomendado para producción)
X-API-Key: ech_live_a1b2c3d4e5f6789012345678901234ab

# Forma 2: Query parameter (útil para pruebas rápidas)
GET /api/sensors/telemetry?X-API-Key=ech_live_a1b2c3d4...`} />

          <SubTitle>Creación de API Key</SubTitle>
          <SpecTable
            headers={['Parámetro', 'Tipo', 'Descripción']}
            rows={[
              ['name', 'string', 'Nombre descriptivo identificador'],
              ['permissions', 'string', '"read" (lectura), "write" (lectura+escritura), "admin" (total)'],
              ['expiresInDays', 'number|null', 'Días hasta expiración; null = sin expiración'],
            ]}
          />

          <SubTitle>Formato de la Clave</SubTitle>
          <Paragraph>
            Cada API Key tiene un formato con prefijo identificativo:
          </Paragraph>
          <CodeBlock language="text — Formato de API Key" code={`Prefijo visible:  ech_live_a1b2c3d4
Clave completa:  ech_live_a1b2c3d4e5f6789012345678901234ab
                ↑ prefijo    ↑ 32 caracteres aleatorios (hex)

- El prefijo se muestra en listados GET /api/api-keys
- La clave COMPLETA solo se muestra UNA VEZ al crearla
- El servidor almacena solo SHA-256(key), nunca la clave en texto plano`} />

          <SubTitle>Flujo de Revocación</SubTitle>
          <StepList
            steps={[
              'El administrador envía DELETE /api/api-keys/[id] (ruta dinámica).',
              'El servidor marca la clave como revocada en la base de datos.',
              'Peticiones futuras con esa clave devuelven 401 Unauthorized.',
              'Las operaciones en curso NO se interrumpen (sin sesión stateful).',
            ]}
          />

          <SubTitle>Auto-Expiración</SubTitle>
          <Paragraph>
            Si una API Key fue creada con <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">expiresInDays</code>, el middleware de autenticación verifica la fecha de expiración en cada petición. Las claves expiradas se rechazan automáticamente con un 401 y un mensaje descriptivo. Las claves con <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">expiresInDays: null</code> no expiran.
          </Paragraph>

          <SubTitle>7.5 Mejores Prácticas de Seguridad</SubTitle>
          <StepList
            steps={[
              'Use HTTPS en todas las comunicaciones (nunca HTTP en producción).',
              'Almacene API Keys en variables de entorno, nunca en el código fuente.',
              'Rote API Keys periódicamente (cada 90 días recomendado).',
              'Implemente whitelist de IPs en el firewall si es posible.',
              'Use certificados TLS para MQTT (MQTTS) y OPC-UA con modo de seguridad "SignAndEncrypt".',
              'Valide la integridad de los datos recibidos en el endpoint de ingest (rangos esperados, checksum).',
              'Monitoree los logs de auditoría para detectar intentos de acceso no autorizado.',
              'Configure rate limiting en el endpoint de ingest para prevenir abuso.',
            ]}
          />

          <CodeBlock language="bash — Variables de entorno obligatorias (.env)" code={`# Configuración del servidor - OBLIGATORIA
JWT_SECRET=super_secret_random_string_256bit

# Base de datos
DATABASE_URL=file:./dev.db

# API Keys para integraciones externas (opcionales)
SCADA_API_KEY_PRIMARY=ech_live_a1b2c3d4e5f6...

# ⚠ NUNCA commitee este archivo al control de versiones
# Añada .env a .gitignore`} />

          <SubTitle>7.6 Rate Limiting</SubTitle>
          <Paragraph>
            Para proteger el servidor contra sobrecarga, se recomienda implementar rate limiting en los endpoints de ingest:
          </Paragraph>
          <SpecTable
            headers={['Endpoint', 'Límite', 'Ventana', 'Notas']}
            rows={[
              ['POST /api/sensors/ingest', '100 req/s', 'Por API Key', 'Suficiente para 100+ sensores a 1Hz'],
              ['GET /api/sensors/telemetry', '30 req/s', 'Por usuario', 'Alineado con polling de 3s'],
              ['POST /api/sensors', '10 req/s', 'Por usuario', 'Operación administrativa'],
              ['PUT /api/sensors/[id]', '30 req/s', 'Por usuario', 'Configuración'],
            ]}
          />
        </Section>

        {/* ============================================================
            SECCIÓN 8: PRUEBAS Y VALIDACIÓN
            ============================================================ */}
        <Section
          id="testing"
          title="8. Pruebas y Validación"
          icon={<CheckCircle2 className="w-4 h-4" />}
          badge="QA"
        >
          <Paragraph>
            Antes de conectar sensores físicos en producción, siga este proceso de validación para asegurar que la integración funciona correctamente.
          </Paragraph>

          <SubTitle>8.1 Prueba de Conectividad del Endpoint</SubTitle>
          <CodeBlock language="bash — Paso 1: Verificar que el endpoint responde" code={`# 1. Verificar autenticación
curl -s -o /dev/null -w "%{http_code}" \\
  https://su-plataforma.com/api/sensors/telemetry \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Esperado: 200

# 2. Sin token (debe fallar)
curl -s -o /dev/null -w "%{http_code}" \\
  https://su-plataforma.com/api/sensors/telemetry
# Esperado: 401

# 3. Con API Key inválida
curl -s -o /dev/null -w "%{http_code}" \\
  -X POST https://su-plataforma.com/api/sensors/ingest \\
  -H "X-API-Key: invalid_key" \\
  -d '{"sensorId":"test","value":1}'
# Esperado: 401 o 403`} />

          <SubTitle>8.2 Prueba de Ingesta con Modo Demo Activado</SubTitle>
          <Paragraph>
            Es recomendable realizar las primeras pruebas con el modo demo activado para comparar el comportamiento de datos simulados vs reales.
          </Paragraph>
          <CodeBlock language="bash — Enviar lecturas de prueba" code={`# Script de prueba: enviar 10 lecturas con valores escalonados
SENSOR_ID="clp1234567890abcdefghij"
API_URL="https://su-plataforma.com/api/sensors/ingest"
TOKEN="your-jwt-token"
API_KEY="su-api-key"

for i in $(seq 1 10); do
  VALUE=$(echo "scale=1; $i * 10" | bc)  # 10, 20, 30... 100

  echo "Enviando lectura $i: $VALUE"
  curl -s -X POST "$API_URL" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer $TOKEN" \\
    -H "X-API-Key: $API_KEY" \\
    -d "{\"sensorId\":\"$SENSOR_ID\",\"value\":$VALUE}" | jq '.status'

  sleep 1
done

# Resultado esperado:
# Lectura 1-7: NORMAL
# Lectura 8 (80): WARNING
# Lectura 9-10 (90, 100): CRITICO`} />

          <SubTitle>8.3 Verificación de Safety Gate</SubTitle>
          <CodeBlock language="bash — Probar activación del Safety Gate" code={`# 1. Enviar un valor CRÍTICO
curl -s -X POST https://su-plataforma.com/api/sensors/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-API-Key: $API_KEY" \\
  -d '{"sensorId":"clp1234567890","value":105}'

# 2. Verificar que el sitio NO es seguro
curl -s https://su-plataforma.com/api/sensors/site-safe \\
  -H "Authorization: Bearer $TOKEN" | jq '.isSafe'
# Esperado: false

# 3. Enviar un valor NORMAL para restaurar seguridad
curl -s -X POST https://su-plataforma.com/api/sensors/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-API-Key: $API_KEY" \\
  -d '{"sensorId":"clp1234567890","value":45}'

# 4. Verificar que el sitio volvió a ser seguro
curl -s https://su-plataforma.com/api/sensors/site-safe \\
  -H "Authorization: Bearer $TOKEN" | jq '.isSafe'
# Esperado: true`} />

          <SubTitle>8.4 Geofence Testing</SubTitle>
          <Paragraph>
            Los endpoints de aprobación y rechazo de permisos verifican la ubicación GPS del supervisor contra el radio de la WorkLocation. A continuación se detallan los procedimientos de prueba.
          </Paragraph>

          <SubTitle>Prueba de Geofence en Aprobación</SubTitle>
          <StepList
            steps={[
              'Cree un permiso de trabajo con WorkLocation que tenga coordenadas GPS y radio definido (ej: radio 100m).',
              'Firme el permiso con el técnico desde un dispositivo GPS.',
              'En el Panel de Aprobaciones, el supervisor abra el permiso y firme.',
              'El sistema calculará la distancia Haversine entre la ubicación GPS del supervisor y el centro de la WorkLocation.',
              'Si el supervisor está DENTRO del radio (distance &lt;= radius): la aprobación se procesa normalmente.',
              'Si el supervisor está FUERA del radio: aparece un diálogo de justificación (mínimo 10 caracteres).',
              'Complete la justificación y confirme la aprobación. El motivo se almacena en la auditoría.',
            ]}
          />

          <CodeBlock language="bash — Aprobación dentro de geocerca" code={`# Simular aprobación con GPS dentro del radio
curl -X POST /api/permits/PERMIT_ID/approve \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "signature": "data:image/png;base64,...",
    "gpsLatitude": 4.7110,
    "gpsLongitude": -74.0721,
    "gpsAccuracy": 12
  }'
# Respuesta esperada:
# { success: true, geofence: { isInside: true, distanceMeters: 42 } }`} />

          <CodeBlock language="bash — Aprobación fuera de geocerca (sin justificación)" code={`# Intentar aprobar desde fuera de la geocerca SIN justificación
curl -X POST /api/permits/PERMIT_ID/approve \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "signature": "data:image/png;base64,...",
    "gpsLatitude": 4.7200,
    "gpsLongitude": -74.0800,
    "gpsAccuracy": 15
  }'
# Respuesta esperada: 403
# { error: "GEOFENCE_JUSTIFICATION_REQUIRED",
#   geofence: { isInside: false, distanceMeters: 1234 } }`} />

          <SubTitle>Prueba de Geofence en Rechazo</SubTitle>
          <StepList
            steps={[
              'Seleccione un permiso pendiente en el Panel de Aprobaciones.',
              'Haga clic en "Rechazar" mientras está FUERA de la geocerca del permiso.',
              'El sistema detecta la ubicación GPS y muestra un campo de justificación adicional.',
              'Escriba una justificación de al menos 10 caracteres explicando por qué rechaza fuera de la geocerca.',
              'Confirme el rechazo. La justificación se prepende al motivo de rechazo almacenado.',
            ]}
          />

          <SubTitle>Prueba del Diálogo "Fuera de Rango"</SubTitle>
          <StepList
            steps={[
              'Abra las herramientas de desarrollador del navegador (F12) → pestaña "Sensors" o use una extensión de simulación GPS.',
              'Establezca una ubicación GPS simulada que esté fuera del radio de la WorkLocation.',
              'Firme el permiso (SignaturePad) — el callback onSign calculará la geofence automáticamente.',
              'Verifique que aparezca el indicador ámbar "Fuera de Geocerca" bajo el pad de firma.',
              'Verifique que al hacer "Aprobar" se abra el diálogo de justificación.',
              'Ingrese menos de 10 caracteres y confirme — debe mostrar error de validación.',
              'Ingrese 10+ caracteres y confirme — la aprobación debe procesarse con éxito.',
            ]}
          />

          <InfoBox type="tip">
            <strong>Consejo de simulación GPS:</strong> En Chrome, abra DevTools → tres puntos → More tools → Sensors → Location. Establezca una coordenada lejos del lugar de trabajo. En dispositivos móviles reales, simplemente camine fuera del radio definido en la WorkLocation.
          </InfoBox>

          <SubTitle>8.5 Prueba de End-to-End Completa</SubTitle>
          <Paragraph>
            Ejecute esta checklist antes de pasar a producción:
          </Paragraph>
          <div className="space-y-2">
            {[
              'Endpoint responde con 200 con token válido y 401 sin token.',
              'Ingesta de valor NORMAL → status "NORMAL" en respuesta.',
              'Ingesta de valor ≥ thresholdWarning → status "WARNING".',
              'Ingesta de valor ≥ thresholdCritical → status "CRITICO".',
              'Safety Gate se activa cuando cualquier sensor = CRITICO.',
              'Safety Gate se desactiva cuando todos los sensores &lt; CRITICO.',
              'Telemetría GET retorna el sensor con su último valor.',
              'Historial de lecturas (GET /readings) muestra las lecturas enviadas.',
              'Toggle demo ON/OFF persiste correctamente en la base de datos.',
              'Rate limiting funciona correctamente bajo carga.',
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="w-5 h-5 rounded border border-slate-300 shrink-0 mt-0.5 flex items-center justify-center text-[10px] text-slate-400 bg-white">
                  {i + 1}
                </span>
                {item}
              </label>
            ))}
          </div>

          <SubTitle>8.6 Herramientas de Diagnóstico</SubTitle>
          <CodeBlock language="bash — Script de diagnóstico completo" code={`#!/bin/bash
# diag_scada.sh — Diagnóstico de integración SCADA

API="https://su-plataforma.com"
TOKEN="your-jwt-token"

echo "=== SCADA Integration Diagnostics ==="
echo ""

# 1. Auth check
echo -n "[1] Autenticación.......... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/sensors/telemetry" \
  -H "Authorization: Bearer $TOKEN")
[[ "$CODE" == "200" ]] && echo "✓ OK" || echo "✗ FAIL ($CODE)"

# 2. Sensors count
echo -n "[2] Sensores registrados... "
COUNT=$(curl -s "$API/api/sensors" -H "Authorization: Bearer $TOKEN" | jq length)
echo "$COUNT encontrado(s)"

# 3. Simulation mode
echo -n "[3] Modo demo.............. "
MODE=$(curl -s "$API/api/sensors/simulation" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.demoMode')
[[ "$MODE" == "true" ]] && echo "ACTIVADO" || echo "DESACTIVADO"

# 4. Site safety
echo -n "[4] Seguridad del sitio.... "
SAFE=$(curl -s "$API/api/sensors/site-safe" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.isSafe')
[[ "$SAFE" == "true" ]] && echo "✓ SEGURO" || echo "✗ NO SEGURO"

echo ""
echo "=== Diagnóstico completo ==="`} />
        </Section>

        {/* ============================================================
            SECCIÓN 9: SOLUCIÓN DE PROBLEMAS
            ============================================================ */}
        <Section
          id="solucion-problemas"
          title="9. Solución de Problemas (Troubleshooting)"
          icon={<AlertTriangle className="w-4 h-4" />}
          badge="Soporte"
        >
          <Paragraph>
            Esta sección documenta los problemas más comunes durante la integración de sensores y sus soluciones.
          </Paragraph>

          <SubTitle>9.1 El sensor muestra "Sin datos" o valor null</SubTitle>
          <SpecTable
            headers={['Síntoma', 'Causa Probable', 'Solución']}
            rows={[
              ['Valor siempre null', 'Sensor marcado como isSimulated=true pero modo demo OFF', 'Cambiar isSimulated a false vía PUT /api/sensors/[id]'],
              ['Valor siempre null', 'No se están enviando lecturas al endpoint de ingest', 'Verificar que el gateway/publisher esté ejecutándose'],
              ['Valor siempre null', 'Sensor inactivo (isActive=false)', 'Reactivar con PUT {"isActive": true}'],
              ['Valor siempre null', 'sensorId incorrecto en el payload', 'Verificar el ID del sensor en GET /api/sensors'],
            ]}
          />

          <SubTitle>9.2 Errores de Autenticación (401 / 403)</SubTitle>
          <SpecTable
            headers={['Código HTTP', 'Causa', 'Solución']}
            rows={[
              ['401', 'JWT Token expirado', 'Inicie sesión nuevamente para obtener un token fresco'],
              ['401', 'API Key inválida o revocada', 'Genere una nueva API Key en el panel de administración'],
              ['401', 'Header Authorization mal formado', 'Asegúrese de incluir "Bearer " antes del token'],
              ['401', 'Token de otra compañía', 'El token debe corresponder a la misma compañía del sensor'],
              ['403', 'Rol sin permisos (OPERARIO)', 'Solicitar upgrade de rol a ADMIN o SUPERVISOR'],
            ]}
          />

          <SubTitle>9.3 El Safety Gate no se desactiva</SubTitle>
          <Paragraph>
            Si el Safety Gate permanece bloqueado incluso después de enviar lecturas normales:
          </Paragraph>
          <StepList
            steps={[
              'Verifique con GET /api/sensors/site-safe cuáles sensores están en CRÍTICO.',
              'Envíe una lectura NORMAL a cada sensor crítico vía POST /api/sensors/ingest.',
              'Verifique que el sensorId del payload coincide exactamente con el ID del sensor crítico.',
              'Espere 3-5 segundos y consulte site-safe nuevamente (puede haber caché del frontend).',
              'Si persiste, verifique que thresholdCritical no esté configurado demasiado bajo (ej: 0).',
            ]}
          />

          <SubTitle>9.4 Datos llegan pero no se actualizan en el Frontend</SubTitle>
          <SpecTable
            headers={['Síntoma', 'Causa', 'Solución']}
            rows={[
              ['LED gris / sin cambios', 'El sensor no tiene lecturas recientes', 'Verificar que se envíen lecturas cada 3-5 seg como mínimo'],
              ['Valor se actualiza lentamente', 'Polling del frontend es cada 3s', 'Comportamiento normal; no se recomienda reducir el intervalo'],
              ['Gráfico vacío', 'No hay lecturas históricas', 'Las lecturas se acumulan con el tiempo; necesita mínimo 2 datos para graficar'],
              ['Pestaña histórica sin datos', 'Sensor recién creado', 'Envíe varias lecturas para generar historial'],
            ]}
          />

          <SubTitle>9.5 Problemas con el Modo Demo</SubTitle>
          <SpecTable
            headers={['Síntoma', 'Causa', 'Solución']}
            rows={[
              ['Toggle no cambia el estado', 'Error de caché del Prisma Client', 'El sistema tiene auto-recovery; espere 30s e intente de nuevo'],
              ['Modo demo se reactiva solo', 'Condición de carrera (resuelto)', 'Asegúrese de usar la versión más reciente del frontend (limpiar caché del navegador)'],
              ['Valores simulados después de desactivar', 'Sensores siguen marcados isSimulated=true', 'Actualizar cada sensor: PUT {"isSimulated": false}'],
            ]}
          />

          <SubTitle>9.6 Problemas con Gateways Externos</SubTitle>
          <SpecTable
            headers={['Problema', 'Método', 'Solución']}
            rows={[
              ['Timeout al conectar', 'Modbus', 'Verificar dirección IP, puerto, y cable RS-485. Probar con modpoll herramienta.'],
              ['No se suscribe a topics', 'MQTT', 'Verificar credenciales, certificado TLS, y formato del topic.'],
              ['Error de certificado TLS', 'MQTT/OPC-UA', 'Instalar certificados raíz del CA. Verificar fecha de expiración.'],
              ['Nodos no encontrados', 'OPC-UA', 'Usar UAExpert para explorar el namespace del servidor OPC-UA.'],
              ['Valores incorrectos', 'Modbus', 'Verificar factor de escala, byte order (big/little endian), y tipo de dato.'],
            ]}
          />

          <SubTitle>9.7 Comandos de Diagnóstico Rápido</SubTitle>
          <CodeBlock language="bash — Comandos de debug" code={`# Verificar conectividad al endpoint de ingest
curl -v -X POST https://su-plataforma.com/api/sensors/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-API-Key: $API_KEY" \\
  -d '{"sensorId":"test","value":1}' 2>&1 | grep "< HTTP"

# Ver estado actual de todos los sensores
curl -s https://su-plataforma.com/api/sensors/telemetry \\
  -H "Authorization: Bearer $TOKEN" | \\
  jq '[.points[] | {name, value, status}]'

# Ver historial de un sensor específico
curl -s "https://su-plataforma.com/api/sensors/SENSOR_ID/readings?limit=5" \\
  -H "Authorization: Bearer $TOKEN" | \\
  jq '.[-5:]'

# Probar Modbus TCP connection
python3 -c "
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient('192.168.1.100', port=502)
print('Conectado:', c.connect())
if c.connect():
    r = c.read_holding_registers(0, 1, slave=1)
    print('Registro 0:', r.registers[0] if not r.isError() else 'Error')
    c.close()
"

# Probar conexión MQTT
mosquitto_sub -h mqtt.su-servidor.com -p 8883 \\
  --cafile /path/to/ca.crt \\
  -u bridge_user -P bridge_pass \\
  -t "scada/sensores/#" -v`} />

          <InfoBox type="tip">
            <strong>¿Necesita más ayuda?</strong> Consulte los logs del servidor en la consola de despliegue para ver mensajes de error detallados. Los endpoints de ingest registran cada intento de ingreso con su resultado (éxito/fallo) para facilitar la auditoría.
          </InfoBox>

          {/* Diagrama de flujo de troubleshooting */}
          <SubTitle>9.8 Diagrama de Flujo de Diagnóstico</SubTitle>
          <CodeBlock language="diagram — Árbol de decisión para troubleshooting" code={`¿El sensor muestra datos?
├── NO → ¿El endpoint de ingest responde?
│   ├── NO → ¿Error de autenticación (401)?
│   │   ├── SÍ → Renovar token / verificar API Key
│   │   └── NO → Verificar conectividad de red / DNS
│   └── SÍ → ¿El payload es válido?
│       ├── NO → Corregir formato JSON / sensorId
│       └── SÍ → ¿El sensor existe y está activo?
│           ├── NO → Crear/reactivar sensor
│           └── SÍ → Verificar logs del servidor
│
└── SÍ → ¿Los valores son correctos?
    ├── NO → ¿Valores escalados incorrectamente?
    │   ├── SÍ → Ajustar factor de escala en gateway
    │   └── NO → ¿Sensor calibrado?
    │       ├── SÍ → Verificar unidad de medida
    │       └── NO → Calibrar sensor físico
    │
    └── SÍ → ¿Los estados son correctos?
        ├── NO → Revisar umbrales (warning < critical)
        └── SÍ → ✓ Integración exitosa`} />

          {/* ── NEW in v3.0 ── */}
          <SubTitle>9.9 Modo Demo nunca se desactiva</SubTitle>
          <SpecTable
            headers={['Síntoma', 'Causa Raíz', 'Solución']}
            rows={[
              ['Toggle muestra "desactivado" pero vuelve a ON', 'Argumentos invertidos en setDemoMode()', 'Verificar que setDemoMode(companyId, enabled) tenga el orden correcto: companyId primero, enabled después'],
              ['El toggle envía POST pero no persiste', 'setDemoMode() falla silenciosamente (catch devuelve valor optimista)', 'Revisar logs del servidor; el engine.ts debe re-lanzar errores en lugar de atraparlos'],
              ['Se desactiva pero el polling lo reactiva', 'Condición de carrera entre polling y toggle (v&lt;2.0)', 'Actualizar frontend: loadTelemetry() NO debe tocar demoMode. Solo loadDemoMode() al montar'],
            ]}
          />
          <CodeBlock language="typescript — Verificación correcta del orden de argumentos" code={`// ❌ INCORRECTO — argumentos invertidos
setDemoMode(enabled, companyId)  // Esto escribiría enabled como companyId

// ✓ CORRECTO — companyId primero, enabled después
setDemoMode(companyId, false)     // Desactiva modo demo para esta compañía`} />

          <InfoBox type="warning">
            Si el problema persiste, verifique que el archivo <code className="font-mono text-xs">src/lib/demo-mode-cache.ts</code> exista. En versiones anteriores este archivo faltaba, causando que <code className="font-mono text-xs">isDemoMode()</code> siempre retornara <code className="font-mono text-xs">true</code>.
          </InfoBox>

          <SubTitle>9.10 Geofence: Error GEOFENCE_JUSTIFICATION_REQUIRED</SubTitle>
          <Paragraph>
            Cuando un supervisor intenta aprobar o rechazar un permiso fuera del radio de la geocerca definida en la WorkLocation, el sistema retorna un error 403 con código <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">GEOFENCE_JUSTIFICATION_REQUIRED</code>.
          </Paragraph>
          <SpecTable
            headers={['Campo', 'Detalle']}
            rows={[
              ['Código HTTP', '403 Forbidden'],
              ['Error code', 'GEOFENCE_JUSTIFICATION_REQUIRED'],
              ['Cuándo ocurre', 'Al aprobar/rechazar un permiso cuando la distancia GPS del supervisor al centro de WorkLocation es mayor al radio configurado'],
              ['Requisito', 'Justificación de mínimo 10 caracteres'],
              ['Cómo resolver (Aprobación)', 'Incluir el campo "approveJustification" en el request con al menos 10 caracteres'],
              ['Cómo resolver (Rechazo)', 'Incluir el campo "rejectGeofenceJustification" en el request con al menos 10 caracteres'],
            ]}
          />
          <CodeBlock language="json — Request con justificación de geofence" code={`{
  "signature": "data:image/png;base64,...",
  "gpsLatitude": 4.7200,
  "gpsLongitude": -74.0800,
  "gpsAccuracy": 15,
  "approveJustification": "Emergencia en planta — autorización remota necesaria por falla de traslado"
}`} />

          <InfoBox type="info">
            El radio efectivo se calcula como: <code className="font-mono text-xs">WorkLocation.radius</code> (primero), <code className="font-mono text-xs">permit.workRadius</code> (segundo), o <code className="font-mono text-xs">100 metros</code> (default). La distancia se calcula con la fórmula Haversine implementada en <code className="font-mono text-xs">src/lib/gps.ts</code>.
          </InfoBox>

          <SubTitle>9.11 Service Worker cache serving stale data</SubTitle>
          <Paragraph>
            Si la aplicación muestra datos antiguos o código JavaScript desactualizado después de un despliegue, es probable que el Service Worker esté sirviendo versiones en caché.
          </Paragraph>
          <SpecTable
            headers={['Síntoma', 'Causa', 'Solución']}
            rows={[
              ['Cambios en la UI no se reflejan', 'Service Worker con estrategia Cache First para scripts', 'Actualizar a sw.js v3+ que usa Network First para scripts'],
              ['Endpoint de API retorna datos antiguos', 'Service Worker cacheando respuestas GET', 'Limpiar caché del navegador o usar Network First'],
              ['El toggle de demo no refleja cambios', 'JS bundle cacheado en Service Worker', 'Forzar actualización: DevTools → Application → Service Workers → Update'],
            ]}
          />
          <CodeBlock language="javascript — Estrategias de caché en sw.js (v3)" code={`// Versionado de caché — actualizar para forzar clear en todos los clientes
const CACHE_VERSION = 'ech-v3'

// Estrategia: Network First para scripts (siempre latest JS)
// self.addEventListener('fetch', (event) => {
//   if (req.url.includes('/_next/static/') || req.url.includes('/api/')) {
//     event.respondWith(networkFirstWithLastCache(req))
//   }
// })

// Estrategia: Stale While Revalidate para assets estáticos
// self.addEventListener('fetch', (event) => {
//   if (req.url.match(/\\.(png|jpg|svg|woff2)$/)) {
//     event.respondWith(staleWhileRevalidate(req))
//   }
// })

// Para forzar limpieza manual:
// 1. Abrir DevTools (F12)
// 2. Application → Storage → Clear site data
// 3. O: DevTools → Application → Service Workers → Unregister + Reload`} />

          <InfoBox type="tip">
            <strong>Cache Busting:</strong> Cada vez que se actualiza el Service Worker, se debe incrementar <code className="font-mono text-xs">CACHE_VERSION</code> en <code className="font-mono text-xs">public/sw.js</code>. Esto fuerza a todos los clientes a descargar los nuevos recursos. La versión actual es <code className="font-mono text-xs">ech-v3</code>.
          </InfoBox>
        </Section>
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-700">Energy-Compliance Hub — Manual Técnico SCADA</span>
          </div>
          <p className="text-xs text-slate-400">
            Documento de referencia para integración de sensores físicos • Versión 3.0
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
              Next.js 15
            </Badge>
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
              Prisma ORM
            </Badge>
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
              TypeScript
            </Badge>
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
              SQLite
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

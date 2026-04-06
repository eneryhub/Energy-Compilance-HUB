export interface Plan {
  name: string
  price: number | null // null = "Contactar con Ventas"
  priceLabel: string // display label
  maxUsers: number
  maxPermitsPerMonth: number
  features: string[]
  featureLabels: Record<string, string>
  description: string
  icon: string
  popular?: boolean
  enterprise?: boolean // special handling for Enterprise
  trialDays: number // trial period in days
}

export const PLANS: Record<string, Plan> = {
  starter: {
    name: 'Starter',
    price: 149,
    priceLabel: '$149',
    maxUsers: 10,
    maxPermitsPerMonth: 200,
    trialDays: 7,
    description: 'Ideal para pequeñas empresas que inician en gestión de permisos y cumplimiento HSE.',
    icon: 'Rocket',
    features: ['firma_basica', 'dashboard_basico', 'soporte_email', 'gps_basico', 'offline', 'pdf_basico'],
    featureLabels: {
      firma_basica: 'Firma digital básica',
      dashboard_basico: 'Dashboard estándar',
      soporte_email: 'Soporte por email',
      gps_basico: 'GPS básico',
      offline: 'Modo offline',
      pdf_basico: 'Generación PDF',
    },
  },
  business: {
    name: 'Business',
    price: 499,
    priceLabel: '$499',
    maxUsers: 50,
    maxPermitsPerMonth: 2000,
    trialDays: 7,
    description: 'Para empresas en crecimiento que necesitan telemetría SCADA, análisis predictivo y reportes profesionales.',
    icon: 'TrendingUp',
    popular: true,
    features: [
      'firma_avanzada', 'dashboard_avanzado', 'soporte_prioritario',
      'geocerca', 'offline', 'api_access', 'reportes_analitica',
      'scada_basico', 'ia_predictiva', 'importacion_masiva',
    ],
    featureLabels: {
      firma_avanzada: 'Firma digital con GPS y geocerca',
      dashboard_avanzado: 'Dashboard analítico',
      soporte_prioritario: 'Soporte prioritario',
      geocerca: 'Validación por geocerca',
      offline: 'Modo offline completo',
      api_access: 'API REST básica',
      reportes_analitica: 'Reportes y analíticas',
      scada_basico: 'SCADA Telemetría en tiempo real',
      ia_predictiva: 'Análisis predictivo con IA',
      importacion_masiva: 'Importación masiva CSV/XLSX',
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    priceLabel: 'Contactar Ventas',
    maxUsers: 999999,
    maxPermitsPerMonth: 999999,
    trialDays: 0,
    description: 'Solución completa para grandes corporaciones con mapas de calor, soporte en plataforma y recursos ilimitados.',
    icon: 'Building2',
    enterprise: true,
    features: [
      'todo_business',
      'mapas_calor', 'soporte_chat', 'api_keys',
      'exportacion_profesional', 'auditoria_completa',
      'diagnostico_sistema', 'ingesta_webhook',
      'usuarios_ilimitados', 'permisos_ilimitados',
    ],
    featureLabels: {
      todo_business: 'Todo lo incluido en plan Business',
      mapas_calor: 'Mapas de calor de riesgo',
      soporte_chat: 'Chat de soporte en plataforma',
      api_keys: 'API completa + API Keys ilimitadas',
      exportacion_profesional: 'Exportación PDF + Excel profesional',
      auditoria_completa: 'Auditoría completa con trazabilidad',
      diagnostico_sistema: 'Diagnóstico del sistema',
      ingesta_webhook: 'Ingesta de sensores por Webhook',
      usuarios_ilimitados: 'Usuarios ilimitados',
      permisos_ilimitados: 'Permisos ilimitados',
    },
  },
}

export const PLAN_ORDER = ['starter', 'business', 'enterprise']

export function getPlan(planName: string): Plan {
  return PLANS[planName] || PLANS.starter
}

export function getNextPlan(currentPlan: string): string | null {
  const idx = PLAN_ORDER.indexOf(currentPlan)
  if (idx < 0 || idx >= PLAN_ORDER.length - 1) return null
  return PLAN_ORDER[idx + 1]
}

export function isDemoMode(): boolean {
  return !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('placeholder')
}

// ============ RISK TYPES (default/fallback) ============

export const RISK_TYPES = {
  ALTURA: { label: 'Trabajo en Altura', color: '#ef4444', icon: 'ArrowUp' },
  ELECTRICO: { label: 'Riesgo Eléctrico', color: '#f59e0b', icon: 'Zap' },
  CONFINADO: { label: 'Espacio Confinado', color: '#8b5cf6', icon: 'Box' },
  CALIENTE: { label: 'Trabajo en Caliente', color: '#dc2626', icon: 'Flame' },
} as const

export type RiskType = keyof typeof RISK_TYPES

export const SAFETY_CHECKLIST: Record<string, { label: string; required: boolean; riskTypes: string[] }> = {
  has_harness: { label: 'Arnés de seguridad colocado', required: true, riskTypes: ['ALTURA'] },
  has_anchor_point: { label: 'Punto de anclaje certificado', required: true, riskTypes: ['ALTURA'] },
  has_dielectric_ppe: { label: 'EPP dieléctrico completo', required: true, riskTypes: ['ELECTRICO'] },
  voltage_test_performed: { label: 'Prueba de ausencia de tensión realizada', required: true, riskTypes: ['ELECTRICO'] },
  atmosphere_monitored: { label: 'Monitoreo de atmósfera realizado', required: true, riskTypes: ['CONFINADO'] },
  has_entry_permit: { label: 'Permiso de entrada vigente', required: true, riskTypes: ['CONFINADO'] },
  has_fire_extinguisher: { label: 'Extintor disponible en el área', required: true, riskTypes: ['CALIENTE'] },
  has_first_aid_kit: { label: 'Botiquín de primeros auxilios disponible', required: false, riskTypes: ['ALTURA', 'ELECTRICO', 'CONFINADO', 'CALIENTE'] },
  briefing_completed: { label: 'Charla de seguridad (briefing) completada', required: false, riskTypes: ['ALTURA', 'ELECTRICO', 'CONFINADO', 'CALIENTE'] },
  emergency_routes_identified: { label: 'Rutas de emergencia identificadas', required: false, riskTypes: ['ALTURA', 'ELECTRICO', 'CONFINADO', 'CALIENTE'] },
}

export function getChecklistForRiskType(riskType: string) {
  return Object.entries(SAFETY_CHECKLIST)
    .filter(([, config]) => config.riskTypes.includes(riskType))
    .map(([key, config]) => ({ key, ...config }))
}

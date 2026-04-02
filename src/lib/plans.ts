export interface Plan {
  name: string
  price: number
  maxUsers: number
  maxPermitsPerMonth: number
  features: string[]
  featureLabels: Record<string, string>
  description: string
  icon: string
  popular?: boolean
}

export const PLANS: Record<string, Plan> = {
  starter: {
    name: 'Starter',
    price: 149,
    maxUsers: 10,
    maxPermitsPerMonth: 200,
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
    maxUsers: 50,
    maxPermitsPerMonth: 2000,
    description: 'Para empresas en crecimiento que necesitan geocerca, IA y analíticas avanzadas.',
    icon: 'TrendingUp',
    popular: true,
    features: ['firma_avanzada', 'dashboard_avanzado', 'soporte_prioritario', 'geocerca', 'offline', 'api_access', 'reportes_analitica'],
    featureLabels: {
      firma_avanzada: 'Firma digital avanzada con GPS',
      dashboard_avanzado: 'Dashboard analítico',
      soporte_prioritario: 'Soporte prioritario',
      geocerca: 'Validación por geocerca',
      offline: 'Modo offline completo',
      api_access: 'Acceso a API',
      reportes_analitica: 'Reportes y analíticas',
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 9999,
    maxUsers: 999999,
    maxPermitsPerMonth: 999999,
    description: 'Solución completa para grandes corporaciones con ERP, auditoría regulatoria y gerente dedicado.',
    icon: 'Building2',
    features: ['firma_legal', 'dashboard_personalizado', 'soporte_247', 'mapas_calor', 'integracion_erp', 'auditoria_entes', 'gerente_cuenta'],
    featureLabels: {
      firma_legal: 'Firma con validez legal',
      dashboard_personalizado: 'Dashboard personalizable',
      soporte_247: 'Soporte 24/7',
      mapas_calor: 'Mapas de calor de riesgo',
      integracion_erp: 'Integración ERP',
      auditoria_entes: 'Auditoría para entes reguladores',
      gerente_cuenta: 'Gerente de cuenta dedicado',
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

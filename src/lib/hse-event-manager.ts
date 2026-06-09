// Energy-Compliance Hub — HSE Event Manager (Event Bus)
// Central event bus for cross-module HSE event orchestration
// Singleton pattern with in-memory subscribers + persistence to HSEEventLog

import { db } from '@/lib/db'

// ============ Types ============

export interface HSEEvent {
  sourceModule: 'TRANSPORT' | 'ENVIRONMENT' | 'SCADA' | 'PERMIT' | 'ERC'
  eventType: string
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  companyId: string
  actorId?: string
  actorName?: string
  relatedEntityId?: string
  relatedEntityType?: string
  metadata?: Record<string, unknown>
}

export type HSEEventHandler = (event: HSEEvent) => void | Promise<void>

// ============ HSEEventManager Class ============

class HSEEventManager {
  private subscribers: Map<string, Set<HSEEventHandler>> = new Map()
  private static instance: HSEEventManager | null = null

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): HSEEventManager {
    if (!HSEEventManager.instance) {
      HSEEventManager.instance = new HSEEventManager()
    }
    return HSEEventManager.instance
  }

  /**
   * Publish an event to in-memory subscribers AND persist to HSEEventLog table.
   * Also triggers cross-module reactions based on event type/severity.
   */
  async emit(event: HSEEvent): Promise<void> {
    const eventId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    console.log(`[HSE Event] ${event.sourceModule}/${event.eventType} [${event.severity}] — ${event.title}`)

    // 1. Persist to HSEEventLog table
    try {
      await db.hSEEventLog.create({
        data: {
          companyId: event.companyId,
          eventId,
          sourceModule: event.sourceModule,
          eventType: event.eventType,
          severity: event.severity,
          title: event.title,
          description: event.description,
          metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
          actorId: event.actorId,
          actorName: event.actorName,
          relatedEntityId: event.relatedEntityId,
          relatedEntityType: event.relatedEntityType,
        },
      })
    } catch (err) {
      console.error('[HSE Event] Failed to persist event log:', err instanceof Error ? err.message : err)
    }

    // 2. Notify in-memory subscribers
    const handlers = this.subscribers.get(event.eventType)
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event)
        } catch (err) {
          console.error(`[HSE Event] Handler error for ${event.eventType}:`, err instanceof Error ? err.message : err)
        }
      }
    }

    // Also notify wildcard subscribers (eventType = '*')
    const wildcardHandlers = this.subscribers.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          await handler(event)
        } catch (err) {
          console.error('[HSE Event] Wildcard handler error:', err instanceof Error ? err.message : err)
        }
      }
    }

    // 3. Cross-module reactions
    await this.executeCrossModuleReactions(event)
  }

  /**
   * Subscribe to a specific event type. Use '*' to subscribe to all events.
   */
  on(eventType: string, handler: HSEEventHandler): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set())
    }
    this.subscribers.get(eventType)!.add(handler)
  }

  /**
   * Unsubscribe a handler from a specific event type.
   */
  off(eventType: string, handler: HSEEventHandler): void {
    const handlers = this.subscribers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscribers.delete(eventType)
      }
    }
  }

  /**
   * Cross-module reaction logic:
   * - TRANSPORT_INCIDENT → auto-creates EnvironmentalIncident with sourceType=TRANSPORT_INCIDENT
   * - DRIVER_ALERT with riskLevel=CRITICO → auto-blocks the trip, creates SystemAlert
   * - ENVIRONMENTAL_INCIDENT with severity=CRITICO → creates EmergencyAlert
   */
  private async executeCrossModuleReactions(event: HSEEvent): Promise<void> {
    try {
      // TRANSPORT_INCIDENT → auto-create EnvironmentalIncident
      if (event.eventType === 'TRANSPORT_INCIDENT' && event.relatedEntityId) {
        console.log(`[HSE Cross] Creating EnvironmentalIncident from transport incident ${event.relatedEntityId}`)
        try {
          await db.environmentalIncident.create({
            data: {
              companyId: event.companyId,
              reportedById: event.actorId || '',
              type: 'DERRAME',
              severity: event.severity === 'CRITICAL' ? 'CRITICO' : event.severity === 'HIGH' ? 'ALTO' : 'MEDIO',
              sourceId: event.relatedEntityId,
              sourceType: 'TRANSPORT_INCIDENT',
              description: `Incidente de transporte: ${event.description}`,
              status: 'REPORTADO',
            },
          })
          console.log('[HSE Cross] EnvironmentalIncident created successfully')
        } catch (err) {
          console.error('[HSE Cross] Failed to create EnvironmentalIncident:', err instanceof Error ? err.message : err)
        }
      }

      // DRIVER_ALERT with CRITICO risk → auto-block trip + SystemAlert
      if (event.eventType === 'DRIVER_ALERT' && event.severity === 'CRITICAL') {
        const tripId = event.metadata?.tripId as string | undefined
        if (tripId) {
          console.log(`[HSE Cross] Blocking trip ${tripId} due to critical driver alert`)
          try {
            await db.transportTrip.update({
              where: { id: tripId },
              data: {
                status: 'BLOQUEADO',
                blockingReason: `Conductor bloqueado por alerta crítica: ${event.title}`,
                blockedById: event.actorId,
                blockedAt: new Date(),
              },
            })

            // Create SystemAlert for GOC
            await db.systemAlert.create({
              data: {
                companyId: event.companyId,
                type: 'DRIVER_CRITICAL',
                severity: 'CRITICAL',
                title: 'Viaje bloqueado — Alerta crítica de conductor',
                message: `El viaje ${tripId} fue bloqueado automáticamente. Motivo: ${event.title}. Conductor: ${event.actorName || 'N/A'}`,
                metadata: JSON.stringify({
                  tripId,
                  eventId: event.eventType,
                  actorName: event.actorName,
                }),
                relatedEntityId: tripId,
                relatedEntityType: 'TRIP',
              },
            })

            console.log(`[HSE Cross] Trip ${tripId} blocked and SystemAlert created`)
          } catch (err) {
            console.error('[HSE Cross] Failed to block trip:', err instanceof Error ? err.message : err)
          }
        }
      }

      // ENVIRONMENTAL_INCIDENT with severity=CRITICO → create EmergencyAlert
      if (event.eventType === 'ENV_INCIDENT_REPORTED' && event.severity === 'CRITICAL') {
        console.log('[HSE Cross] Creating EmergencyAlert from critical environmental incident')
        try {
          await db.emergencyAlert.create({
            data: {
              companyId: event.companyId,
              userId: event.actorId || '',
              tipo: 'DERRAME',
              descripcion: event.description,
              prioridad: 'CRITICA',
              estado: 'ACTIVA',
            },
          })
          console.log('[HSE Cross] EmergencyAlert created successfully')
        } catch (err) {
          console.error('[HSE Cross] Failed to create EmergencyAlert:', err instanceof Error ? err.message : err)
        }
      }
    } catch (err) {
      console.error('[HSE Cross] Error in cross-module reactions:', err instanceof Error ? err.message : err)
    }
  }
}

// ============ Export singleton instance ============
export const hseEventManager = HSEEventManager.getInstance()

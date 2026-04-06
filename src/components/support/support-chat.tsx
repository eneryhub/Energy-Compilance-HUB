'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface SupportMessage {
  id: string
  message: string
  senderType: string
  userName?: string | null
  isRead: boolean
  createdAt: string
}

interface SupportChatProps {
  plan: string // subscriptionPlan
  onUpgradeRequest?: () => void
}

export default function SupportChat({ plan, onUpgradeRequest }: SupportChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isAccessible = plan === 'enterprise'

  const loadMessages = useCallback(async () => {
    if (!isAccessible) return
    setLoading(true)
    try {
      const res = await apiFetch<{ messages: SupportMessage[] }>('/support/messages')
      setMessages(res.messages)
    } catch (err) {
      console.error('Error loading support messages:', err)
    } finally {
      setLoading(false)
    }
  }, [isAccessible])

  useEffect(() => {
    if (open && isAccessible) {
      loadMessages()
    }
  }, [open, isAccessible, loadMessages])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      const res = await apiFetch<{ success: boolean; message: SupportMessage }>('/support/messages', {
        method: 'POST',
        body: JSON.stringify({ message: input.trim() }),
      })
      if (res.success) {
        setMessages((prev) => [...prev, res.message])
        // Load again to get the system auto-reply
        setTimeout(() => loadMessages(), 500)
        setInput('')
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Unread count from system/support messages
  const unreadCount = messages.filter((m) => !m.isRead && m.senderType !== 'USER').length

  // Format time
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-4 right-4 z-50">
        {!open && (
          <button
            onClick={() => {
              if (!isAccessible) {
                onUpgradeRequest?.()
                return
              }
              setOpen(true)
            }}
            className={cn(
              'w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110',
              isAccessible
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-600 hover:bg-slate-700 text-white relative'
            )}
          >
            <MessageCircle className="w-6 h-6" />
            {!isAccessible && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">!</span>
              </div>
            )}
            {isAccessible && unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </div>
            )}
          </button>
        )}

        {/* Chat Panel */}
        {open && (
          <div className="w-[360px] max-w-[calc(100vw-2rem)] h-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Soporte ECH</p>
                  <p className="text-[10px] text-emerald-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    En línea — Plan Enterprise
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10">
                  <Bot className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">Centro de Soporte</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Escribe tu consulta y nuestro equipo te responderá a la brevedad.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.senderType === 'USER'
                  return (
                    <div key={msg.id} className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                      )}
                      <div className={cn('max-w-[75%]')}>
                        <div
                          className={cn(
                            'px-3 py-2 rounded-2xl text-sm leading-relaxed',
                            isUser
                              ? 'bg-emerald-600 text-white rounded-br-md'
                              : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                          )}
                        >
                          {msg.message}
                        </div>
                        <p className={cn('text-[10px] text-slate-400 mt-0.5', isUser ? 'text-right' : 'text-left')}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                      {isUser && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 text-sm"
                  disabled={sending}
                  maxLength={2000}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 w-9 shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5 text-center">
                Soporte Enterprise — Respuesta en horario laboral
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

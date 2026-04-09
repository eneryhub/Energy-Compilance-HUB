'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Send,
  Loader2,
  Brain,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { apiFetch } from '@/lib/api'

// ============ Types ============

interface ChatSource {
  id: string
  documentTitle: string
  documentType: string
  similarity: number
  chunkContent: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  aiSource?: string
  timestamp: string
}

interface PaperclipResponse {
  answer: string
  sources: ChatSource[]
  aiSource?: string
}

// ============ Animation Variants ============

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const messageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
}

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

const emptyStateVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut', delay: 0.1 },
  },
}

// ============ Suggestion Questions ============

const SUGGESTIONS = [
  {
    icon: '🏗️',
    question: '¿Cuales son los requisitos para trabajo en altura?',
  },
  {
    icon: '🔥',
    question: 'Procedimiento de emergencia por fuga de gas',
  },
  {
    icon: '⚡',
    question: 'Normativa para trabajos electricos en baja tension',
  },
  {
    icon: '🛡️',
    question: 'EPP obligatorio para entrada a espacios confinados',
  },
  {
    icon: '🚧',
    question: 'Permisos de trabajo requeridos para excavaciones',
  },
  {
    icon: '🧪',
    question: 'Protocolo de manejo de sustancias quimicas peligrosas',
  },
]

// ============ Helpers ============

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.85) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (similarity >= 0.7) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function getDocumentTypeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case 'procedimiento':
    case 'procedure':
      return 'bg-emerald-600 text-white'
    case 'norma':
    case 'standard':
      return 'bg-teal-600 text-white'
    case 'politica':
    case 'policy':
      return 'bg-slate-700 text-white'
    case 'manual':
      return 'bg-amber-600 text-white'
    case 'plan':
      return 'bg-orange-600 text-white'
    case 'instructivo':
      return 'bg-cyan-700 text-white'
    default:
      return 'bg-slate-600 text-white'
  }
}

// ============ Loading Indicator ============

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-start gap-3 max-w-2xl"
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
        <Brain className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
          <span className="text-sm text-slate-500">Analizando documentos...</span>
        </div>
        <div className="flex gap-1.5 mt-2 ml-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ============ Source Card ============

function SourceCard({ source }: { source: ChatSource }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-slate-150 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left group">
        <Badge className={getDocumentTypeColor(source.documentType)}>
          {source.documentType}
        </Badge>
        <span className="text-xs font-medium text-slate-700 flex-1 truncate">
          {source.documentTitle}
        </span>
        <Badge className={getSimilarityColor(source.similarity)}>
          {Math.round(source.similarity * 100)}% similitud
        </Badge>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </motion.div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-3 pt-2 pb-1">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">
                {source.chunkContent}
              </p>
            </div>
          </div>
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ============ Chat Message ============

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <motion.div
        variants={messageVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex justify-end"
      >
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="bg-slate-700 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex justify-end mt-1 mr-1">
            <span className="text-[10px] text-slate-400">
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex items-start gap-3 max-w-[90%] sm:max-w-[80%]"
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
        <Sparkles className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 px-1">
              <FileText className="w-3 h-3" />
              Fuentes ({message.sources.length})
            </p>
            <div className="space-y-1.5">
              {message.sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>
        )}

        {/* Timestamp & AI source label */}
        <div className="flex items-center gap-2 mt-1.5 ml-1">
          <span className="text-[10px] text-slate-400">
            {formatTime(message.timestamp)}
          </span>
          {message.aiSource && (
            <>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] text-emerald-500 font-medium">
                Paperclip IA
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============ Empty State ============

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (q: string) => void }) {
  return (
    <motion.div
      variants={emptyStateVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4"
    >
      <motion.div
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center mb-5 border border-emerald-200"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <MessageSquare className="w-7 h-7 text-emerald-600" />
      </motion.div>

      <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-2">
        Inicia una conversacion
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        Haz preguntas sobre documentos HSE indexados. La IA buscara respuestas
        relevantes y te mostrara las fuentes consultadas.
      </p>

      <div className="w-full max-w-lg">
        <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
          Preguntas sugeridas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTIONS.map((suggestion, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              onClick={() => onSuggestionClick(suggestion.question)}
              className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
            >
              <span className="text-base flex-shrink-0 mt-0.5">
                {suggestion.icon}
              </span>
              <span className="text-xs text-slate-600 group-hover:text-emerald-700 leading-relaxed transition-colors">
                {suggestion.question}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ============ Welcome Message ============

function WelcomeMessage() {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className="flex items-start gap-3 max-w-[90%] sm:max-w-[80%]"
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
        <Sparkles className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
          <p className="text-sm text-slate-700 leading-relaxed">
            Hola, soy <strong className="text-emerald-700">Paperclip IA</strong>. Estoy aqui para ayudarte a buscar informacion en tus documentos HSE indexados.
            Hazme cualquier pregunta sobre normativas, procedimientos o politicas de seguridad.
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ============ Main Component ============

export default function PaperclipChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return

      const trimmedQuestion = question.trim()
      setInput('')
      setError(null)

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmedQuestion,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setLoading(true)

      try {
        // Build history from last 6 messages
        const history = [...messages, userMessage]
          .slice(-6)
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))

        const response = await apiFetch<PaperclipResponse>('/ai/paperclip', {
          method: 'POST',
          body: JSON.stringify({
            question: trimmedQuestion,
            history,
          }),
        })

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.answer,
          sources: response.sources || [],
          aiSource: response.aiSource || 'Paperclip IA',
          timestamp: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, assistantMessage])
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido'

        const errorAssistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: '',
          sources: [],
          aiSource: 'Paperclip IA',
          timestamp: new Date().toISOString(),
        }

        // Insert a user-friendly error as assistant message
        setMessages((prev) => [
          ...prev,
          {
            ...errorAssistantMessage,
            id: generateId(),
            content: `Lo siento, no pude procesar tu consulta. ${errorMessage}. Por favor, intenta de nuevo.`,
          },
        ])

        setError(errorMessage)
      } finally {
        setLoading(false)
        setTimeout(scrollToBottom, 100)
      }
    },
    [loading, messages, scrollToBottom]
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      sendMessage(input)
    },
    [input, sendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    },
    [input, sendMessage]
  )

  const handleSuggestionClick = useCallback(
    (question: string) => {
      sendMessage(question)
    },
    [sendMessage]
  )

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full min-h-[600px] max-h-[calc(100vh-120px)]">
      {/* ============ Header ============ */}
      <motion.div variants={headerVariants} initial="hidden" animate="visible">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-200">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Paperclip IA</h2>
            <p className="text-xs text-slate-500">
              Busqueda semantica en documentos HSE
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-emerald-800 font-medium leading-relaxed">
              Busqueda inteligente con fuentes verificables
            </p>
            <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
              La IA busca en tus documentos HSE indexados y cita las fuentes consultadas.
              Cada respuesta incluye enlaces a los documentos originales con su nivel de similitud.
            </p>
          </div>
        </div>
      </motion.div>

      <Separator className="mb-0" />

      {/* ============ Chat Area ============ */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="px-2 sm:px-4 py-4 space-y-4" ref={messagesEndRef}>
            {!hasMessages ? (
              <EmptyState onSuggestionClick={handleSuggestionClick} />
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {/* Show welcome message only if no user messages yet */}
                {messages.length > 0 && messages[0].role === 'assistant' && (
                  <WelcomeMessage />
                )}

                <AnimatePresence mode="popLayout">
                  {messages.map((message) => (
                    <ChatMessageBubble key={message.id} message={message} />
                  ))}
                </AnimatePresence>

                {/* Error banner */}
                {error && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 max-w-2xl mx-auto"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600">{error}</p>
                  </motion.div>
                )}

                {/* Loading / Thinking indicator */}
                <AnimatePresence>
                  {loading && <ThinkingIndicator />}
                </AnimatePresence>

                <div ref={messagesEndRef} className="scroll-mt-4" />
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* ============ Input Area (sticky) ============ */}
      <div className="bg-white border-t-0 p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta sobre documentos HSE..."
                disabled={loading}
                className="resize-none pr-4 py-3 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white text-sm min-h-[44px] max-h-[120px] transition-colors"
                rows={1}
              />
              <div className="absolute right-2 bottom-1.5">
                <span className="text-[10px] text-slate-400">
                  Enter para enviar, Shift+Enter nueva linea
                </span>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="icon"
              className="h-[44px] w-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 disabled:shadow-none disabled:opacity-50 transition-all flex-shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="sr-only">Enviar mensaje</span>
            </Button>
          </div>
        </form>

        {/* Disclaimer */}
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Las respuestas son generadas por IA y pueden contener imprecisiones.
          Siempre verifica con los documentos fuente oficiales.
        </p>
      </div>
    </div>
  )
}

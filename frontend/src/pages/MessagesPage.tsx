import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Save,
  Loader2,
  RotateCcw,
  Zap,
  UserPlus,
  CalendarClock,
  CreditCard,
  Star,
  Truck,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Info,
  AlertCircle,
} from 'lucide-react'
import { messagesApi } from '@/lib/api'
import type { MessageTemplateOut } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// ─── flow config ──────────────────────────────────────────────────────────────

const FLOW_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  webhook: {
    label: 'Respostas Automáticas',
    icon: Zap,
    description:
      'Enviadas imediatamente quando um lead manda WhatsApp para o número do estabelecimento.',
  },
  novo_lead: {
    label: 'Fluxo 1 — Novo Lead',
    icon: UserPlus,
    description:
      'Mensagem enviada automaticamente nos primeiros minutos após o lead ser criado no CRM.',
  },
  pre_evento: {
    label: 'Fluxo 2 — Pré-evento',
    icon: CalendarClock,
    description:
      'Lembretes enviados com antecedência antes do evento confirmado (D-90, D-30, D-7, D-1).',
  },
  pagamento: {
    label: 'Fluxo 3 — Pagamentos',
    icon: CreditCard,
    description:
      'Lembretes de vencimento e confirmação de recebimento de parcelas.',
  },
  pos_evento: {
    label: 'Fluxo 4 — Pós-evento',
    icon: Star,
    description:
      'Agradecimento, pesquisa NPS e reengajamento após o evento realizado.',
  },
  fornecedor: {
    label: 'Fluxo 5 — Fornecedores',
    icon: Truck,
    description:
      'Notificações automáticas enviadas aos fornecedores antes do evento (D-30, D-7, D-1).',
  },
  nurturing: {
    label: 'Fluxo 6 — Nurturing',
    icon: TrendingUp,
    description:
      'Sequência de mensagens para leads que ainda não converteram (score 30–59).',
  },
}

const FLOW_ORDER = [
  'webhook',
  'novo_lead',
  'pre_evento',
  'pagamento',
  'pos_evento',
  'fornecedor',
  'nurturing',
]

// ─── template card ────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: MessageTemplateOut }) {
  const qc = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState(template.body)
  const [isActive, setIsActive] = useState(template.is_active)

  const isDirty = body !== template.body || isActive !== template.is_active

  const variables: string[] = (() => {
    try {
      return JSON.parse(template.variables ?? '[]')
    } catch {
      return []
    }
  })()

  const mutation = useMutation({
    mutationFn: (data: { body: string; is_active: boolean }) =>
      messagesApi.update(template.id, data),
    onSuccess: (updated) => {
      qc.setQueryData<MessageTemplateOut[]>(['messages'], (prev) =>
        prev?.map((t) => (t.id === updated.id ? updated : t)) ?? [updated],
      )
      toast.success('Template salvo!')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleSave() {
    mutation.mutate({ body, is_active: isActive })
  }

  function handleReset() {
    setBody(template.body)
    setIsActive(template.is_active)
  }

  /** Insere {variavel} na posição do cursor dentro do textarea */
  function insertVariable(v: string) {
    const ta = textareaRef.current
    const tag = `{${v}}`

    if (!ta) {
      navigator.clipboard.writeText(tag)
      toast.success(`${tag} copiado!`)
      return
    }

    const start = ta.selectionStart ?? body.length
    const end = ta.selectionEnd ?? body.length
    const newBody = body.slice(0, start) + tag + body.slice(end)
    setBody(newBody)

    // Reposiciona o cursor após o texto inserido
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + tag.length
      ta.setSelectionRange(pos, pos)
    })
  }

  return (
    <Card className={!isActive ? 'opacity-55' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <CardTitle className="text-sm font-semibold leading-snug">
              {template.title}
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs font-normal max-w-[260px] truncate">
                {template.trigger}
              </Badge>
              <Badge variant="secondary" className="text-xs font-normal gap-1 shrink-0">
                <span className="text-green-600">●</span> WhatsApp
              </Badge>
            </div>
          </div>
          <Button
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 gap-1.5 text-xs h-7 px-2.5"
            onClick={() => setIsActive((v) => !v)}
          >
            {isActive ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {isActive ? 'Ativo' : 'Inativo'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="text-sm font-mono resize-y leading-relaxed"
          placeholder="Texto da mensagem..."
        />

        {variables.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Variáveis — clique para inserir no cursor:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  title={`Inserir {${v}} no cursor`}
                  className="inline-flex items-center rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-xs font-mono text-primary hover:bg-primary/15 hover:border-primary transition-colors cursor-pointer"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {isDirty && (
          <div className="flex items-center gap-2 pt-1 border-t mt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleReset}
              disabled={mutation.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── flow section ─────────────────────────────────────────────────────────────

function FlowSection({
  flow,
  templates,
}: {
  flow: string
  templates: MessageTemplateOut[]
}) {
  const config = FLOW_CONFIG[flow]
  if (!config || templates.length === 0) return null
  const Icon = config.icon

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">{config.label}</h2>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((tpl) => (
          <TemplateCard key={tpl.id} template={tpl} />
        ))}
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function MessagesPage() {
  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['messages'],
    queryFn: () => messagesApi.list(),
    retry: 1,
  })

  const grouped = templates.reduce<Record<string, MessageTemplateOut[]>>(
    (acc, tpl) => {
      if (!acc[tpl.flow]) acc[tpl.flow] = []
      acc[tpl.flow].push(tpl)
      return acc
    },
    {},
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-semibold">Mensagens Automáticas</h1>
        <p className="text-muted-foreground mt-1">
          Personalize os textos enviados automaticamente via WhatsApp em cada etapa do CRM.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-md border bg-blue-50 border-blue-200 p-3.5">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          Edite o texto no campo abaixo e clique nos botões de variável para inserí-las no cursor.
          Use <code className="bg-blue-100 px-1 rounded font-mono">{'{nome}'}</code>,{' '}
          <code className="bg-blue-100 px-1 rounded font-mono">{'{valor}'}</code> etc. para
          dados dinâmicos preenchidos automaticamente. Templates inativos não são enviados.
        </p>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-start gap-2 rounded-md border bg-red-50 border-red-200 p-3.5">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800 space-y-1">
            <p className="font-medium">Não foi possível carregar os templates.</p>
            <p>
              Execute a migração do banco de dados:{' '}
              <code className="bg-red-100 px-1 rounded font-mono">
                docker compose exec api alembic upgrade head
              </code>
            </p>
          </div>
        </div>
      )}

      {/* Sections */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <div className="grid gap-3 md:grid-cols-2">
                <Skeleton className="h-52" />
                <Skeleton className="h-52" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 && !isError ? (
        <div className="flex items-start gap-2 rounded-md border bg-amber-50 border-amber-200 p-3.5">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-medium">Nenhum template encontrado.</p>
            <p>
              Execute a migração para criar os templates padrão:{' '}
              <code className="bg-amber-100 px-1 rounded font-mono">
                docker compose exec api alembic upgrade head
              </code>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {FLOW_ORDER.map((flow, idx) => (
            <div key={flow}>
              {idx > 0 && <Separator className="mb-8" />}
              <FlowSection flow={flow} templates={grouped[flow] ?? []} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

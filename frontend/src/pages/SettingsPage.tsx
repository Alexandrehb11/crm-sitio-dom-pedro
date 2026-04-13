import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, EyeOff, ExternalLink, Save, Loader2, Info, RefreshCw, Webhook, CheckCircle2 } from 'lucide-react'
import { settingsApi, webhooksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'

// ─── field descriptors ───────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  description: string
  sensitive?: boolean
  type?: 'text' | 'select'
  options?: { value: string; label: string }[]
  docsUrl?: string
  docsLabel?: string
  placeholder?: string
}

interface Section {
  title: string
  description: string
  status: 'required' | 'optional'
  fields: FieldDef[]
}

const SECTIONS: Section[] = [
  {
    title: 'Segurança — JWT',
    description: 'Chave secreta para assinatura dos tokens de autenticação. Alterar exige novo login de todos os usuários.',
    status: 'required',
    fields: [
      {
        key: 'AES_SECRET_KEY',
        label: 'Chave Secreta JWT',
        description: 'Mínimo 32 caracteres aleatórios. Gere com: openssl rand -hex 32',
        sensitive: true,
        placeholder: 'sua-chave-secreta-aqui',
      },
    ],
  },
  {
    title: 'WhatsApp — Mensageria Automática',
    description: 'Envio automático de mensagens para leads: boas-vindas, confirmação de visita, proposta e lembrete.',
    status: 'optional',
    fields: [
      {
        key: 'WHATSAPP_PROVIDER',
        label: 'Provedor WhatsApp',
        description: 'Selecione qual API WhatsApp utilizar.',
        type: 'select',
        options: [
          { value: 'evolution', label: 'Evolution API' },
          { value: 'zapi', label: 'Z-API' },
        ],
      },
      {
        key: 'EVOLUTION_API_URL',
        label: 'Evolution API — URL',
        description: 'URL base da sua instância Evolution API.',
        placeholder: 'https://api.seudominio.com',
        docsUrl: 'https://doc.evolution-api.com/v2/api-reference/authentication',
        docsLabel: 'Docs Evolution API',
      },
      {
        key: 'EVOLUTION_API_KEY',
        label: 'Evolution API — Chave',
        description: 'Manager → API Key global da Evolution.',
        sensitive: true,
        placeholder: 'sua-api-key',
      },
      {
        key: 'EVOLUTION_INSTANCE',
        label: 'Evolution API — Instância',
        description: 'Nome da instância WhatsApp cadastrada.',
        placeholder: 'sitio-dom-pedro',
      },
      {
        key: 'ZAPI_INSTANCE_ID',
        label: 'Z-API — Instance ID',
        description: 'ID da instância Z-API.',
        sensitive: true,
        placeholder: 'xxxxxxxx',
        docsUrl: 'https://z-api.io/docs',
        docsLabel: 'Docs Z-API',
      },
      {
        key: 'ZAPI_TOKEN',
        label: 'Z-API — Token',
        description: 'Token de autenticação da instância Z-API.',
        sensitive: true,
        placeholder: 'xxxxxxxx',
      },
      {
        key: 'ZAPI_SECURITY_TOKEN',
        label: 'Z-API — Security Token',
        description: 'Token de segurança adicional (se habilitado no painel).',
        sensitive: true,
        placeholder: 'xxxxxxxx',
      },
    ],
  },
  {
    title: 'Asaas — Meios de Pagamento',
    description: 'Geração de cobranças via Pix, Boleto e Cartão de Crédito com atualização automática de status.',
    status: 'optional',
    fields: [
      {
        key: 'ASAAS_API_KEY',
        label: 'Chave de API',
        description: 'Asaas → Minha Conta → Integrações → Chave de API.',
        sensitive: true,
        placeholder: '$aact_YTU5Y...',
        docsUrl: 'https://docs.asaas.com/reference/criar-nova-cobranca',
        docsLabel: 'Docs Asaas',
      },
      {
        key: 'ASAAS_ENVIRONMENT',
        label: 'Ambiente',
        description: 'Use sandbox para testes e producao para cobranças reais.',
        type: 'select',
        options: [
          { value: 'sandbox', label: 'Sandbox (testes)' },
          { value: 'producao', label: 'Produção' },
        ],
      },
    ],
  },
  {
    title: 'ZapSign — Assinatura Digital',
    description: 'Envio e coleta de assinaturas digitais em contratos via ZapSign.',
    status: 'optional',
    fields: [
      {
        key: 'ZAPSIGN_API_TOKEN',
        label: 'Token de API',
        description: 'ZapSign → Configurações → API → Token de acesso.',
        sensitive: true,
        placeholder: 'seu-token-zapsign',
        docsUrl: 'https://docs.zapsign.com.br/api',
        docsLabel: 'Docs ZapSign',
      },
    ],
  },
  {
    title: 'E-mail — SendGrid',
    description: 'Envio de e-mails transacionais: confirmações, propostas e notificações.',
    status: 'optional',
    fields: [
      {
        key: 'SENDGRID_API_KEY',
        label: 'API Key SendGrid',
        description: 'SendGrid → Settings → API Keys → Create API Key.',
        sensitive: true,
        placeholder: 'SG.xxxxxxxxx',
        docsUrl: 'https://docs.sendgrid.com/for-developers/sending-email/api-getting-started',
        docsLabel: 'Docs SendGrid',
      },
      {
        key: 'EMAIL_FROM',
        label: 'E-mail Remetente',
        description: 'Endereço de e-mail verificado no SendGrid para envio.',
        placeholder: 'contato@seudominio.com.br',
      },
    ],
  },
  {
    title: 'OpenAI — Inteligência Artificial',
    description: 'Funcionalidades opcionais de IA: sugestões automáticas, análise de leads e geração de propostas.',
    status: 'optional',
    fields: [
      {
        key: 'OPENAI_API_KEY',
        label: 'API Key OpenAI',
        description: 'platform.openai.com → API Keys → Create new secret key.',
        sensitive: true,
        placeholder: 'sk-...',
        docsUrl: 'https://platform.openai.com/docs/api-reference',
        docsLabel: 'Docs OpenAI',
      },
    ],
  },
  {
    title: 'Google Calendar — Sincronização de Eventos',
    description: 'Sincronize eventos do CRM com a agenda do Google. Requer Service Account com acesso à API Calendar v3.',
    status: 'optional',
    fields: [
      {
        key: 'GOOGLE_CALENDAR_CREDENTIALS_JSON',
        label: 'Credenciais Service Account (JSON)',
        description: 'Cole o JSON do Service Account (Google Cloud Console → IAM → Service Accounts → Criar chave JSON). Compartilhe a agenda com o e-mail do service account.',
        sensitive: true,
        placeholder: '{"type":"service_account","project_id":"meu-projeto",...}',
      },
      {
        key: 'GOOGLE_CALENDAR_ID',
        label: 'ID da Agenda',
        description: 'E-mail da agenda do Google ou ID (encontrado em Configurações da Agenda → Integrar agenda).',
        placeholder: 'sitiodomPedro@gmail.com',
      },
    ],
  },
]

// ─── sub-components ───────────────────────────────────────────────────────────

interface FieldInputProps {
  field: FieldDef
  value: string
  onChange: (key: string, value: string) => void
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const [show, setShow] = useState(false)

  if (field.type === 'select' && field.options) {
    return (
      <Select value={value} onValueChange={v => onChange(field.key, v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {field.options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="relative">
      <Input
        type={field.sensitive && !show ? 'password' : 'text'}
        value={value}
        onChange={e => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        className={field.sensitive ? 'pr-10 font-mono text-sm' : 'font-mono text-sm'}
        autoComplete="off"
      />
      {field.sensitive && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookRegistered, setWebhookRegistered] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  useEffect(() => {
    if (data) {
      setValues(data.values)
      setDirty(false)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.update(values),
    onSuccess: (result) => {
      qc.setQueryData(['settings'], result)
      setDirty(false)
      toast.success('Configurações salvas! Reinicie o servidor para aplicar as alterações.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleChange(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const registerWebhookMutation = useMutation({
    mutationFn: () => webhooksApi.registerEvolution(webhookUrl),
    onSuccess: (result) => {
      setWebhookRegistered(true)
      toast.success(`Webhook registrado! Evolution enviará mensagens para: ${result.webhook_url}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleReset() {
    if (data) {
      setValues(data.values)
      setDirty(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Configurações</h1>
          <p className="text-muted-foreground mt-1">Chaves de API e integrações do sistema</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && (
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Descartar
            </Button>
          )}
          <Button
            size="sm"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="gap-1.5"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-md border bg-blue-50 border-blue-200 p-4">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          As configurações são salvas no arquivo <code className="bg-blue-100 px-1 rounded font-mono">.env</code> do servidor.
          Após salvar, <strong>reinicie o backend</strong> para as alterações entrarem em vigor:{' '}
          <code className="bg-blue-100 px-1 rounded font-mono">docker compose restart api</code>
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="mt-1">{section.description}</CardDescription>
                </div>
                <Badge variant={section.status === 'required' ? 'default' : 'secondary'} className="shrink-0">
                  {section.status === 'required' ? 'Obrigatório' : 'Opcional'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {section.fields.map((field, idx) => (
                  <div key={field.key}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {field.key}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                      {isLoading ? (
                        <Skeleton className="h-9 w-full" />
                      ) : (
                        <FieldInput
                          field={field}
                          value={values[field.key] ?? ''}
                          onChange={handleChange}
                        />
                      )}
                      {field.docsUrl && (
                        <a
                          href={field.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          {field.docsLabel}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Webhook Registration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhook WhatsApp — Receber Mensagens
              </CardTitle>
              <CardDescription className="mt-1">
                Configure a Evolution API para enviar mensagens recebidas ao CRM. Assim, quando alguém mandar WhatsApp, um lead é criado automaticamente.
              </CardDescription>
            </div>
            {webhookRegistered && (
              <Badge variant="green" className="shrink-0 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Registrado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>URL pública do seu backend</Label>
            <p className="text-xs text-muted-foreground">
              O endereço que a Evolution API vai chamar quando chegar uma mensagem. Precisa ser acessível pela internet (domínio ou IP público). Ex: <code className="bg-muted px-1 rounded">https://api.seudominio.com.br</code>
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://api.seudominio.com.br"
                value={webhookUrl}
                onChange={e => { setWebhookUrl(e.target.value); setWebhookRegistered(false) }}
                className="font-mono text-sm"
              />
              <Button
                onClick={() => registerWebhookMutation.mutate()}
                disabled={!webhookUrl.startsWith('http') || registerWebhookMutation.isPending}
                className="shrink-0 gap-1.5"
              >
                {registerWebhookMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Webhook className="h-4 w-4" />
                )}
                Registrar Webhook
              </Button>
            </div>
          </div>
          <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>O que acontece ao registrar:</strong></p>
            <p>• A Evolution API passará a enviar cada mensagem recebida para <code className="bg-muted px-1 rounded">[sua URL]/api/webhooks/whatsapp</code></p>
            <p>• Se o número já for um lead, o CRM responde automaticamente</p>
            <p>• Se o número for novo, um lead é criado e uma mensagem de boas-vindas é enviada</p>
          </div>
        </CardContent>
      </Card>

      {/* Bottom save button */}
      <div className="flex justify-end gap-2 pt-2">
        {dirty && (
          <Button variant="outline" onClick={handleReset} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Descartar alterações
          </Button>
        )}
        <Button
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="gap-1.5"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  )
}

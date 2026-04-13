/**
 * Página pública — Formulário "Verificar Data"
 * Rota: /verificar-data (sem autenticação)
 *
 * Captura lead via formulário do site, verifica disponibilidade e
 * lê parâmetros UTM da URL automaticamente.
 */

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, XCircle, Loader2, CalendarCheck } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(10, 'WhatsApp obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  event_date: z.string().min(1, 'Data obrigatória'),
  event_type: z.string().default('outro'),
  guest_count: z.coerce.number().int().min(1).optional(),
  budget: z.coerce.number().min(0).optional(),
  source_channel: z.string().default('formulario'),
  notes: z.string().optional(),
  consent_lgpd: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar a política de privacidade' }) }),
})

type FormValues = z.infer<typeof schema>

interface VerifyResponse {
  available: boolean
  message: string
  lead_id?: string
  alternative_dates: string[]
}

function getUTMParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
  }
}

export function PublicFormPage() {
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    setServerError('')
    setResult(null)
    try {
      const utm = getUTMParams()
      const payload = {
        ...values,
        email: values.email || undefined,
        ...utm,
      }
      const resp = await fetch(`${API_BASE}/api/leads/verify-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data: VerifyResponse = await resp.json()
      if (!resp.ok) {
        setServerError((data as unknown as { detail: string }).detail ?? 'Erro ao enviar')
        return
      }
      setResult(data)
    } catch {
      setServerError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          {result.available ? (
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          ) : (
            <XCircle className="h-16 w-16 text-amber-500 mx-auto" />
          )}
          <h2 className="text-xl font-semibold text-stone-800">
            {result.available ? 'Data disponível!' : 'Data indisponível'}
          </h2>
          <p className="text-stone-600 text-sm leading-relaxed">{result.message}</p>
          {!result.available && result.alternative_dates.length > 0 && (
            <div className="bg-stone-50 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-stone-700 mb-2">Datas disponíveis:</p>
              <ul className="space-y-1">
                {result.alternative_dates.map((d) => (
                  <li key={d} className="text-sm text-green-700 font-medium">• {d}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={() => setResult(null)}
            className="text-sm text-stone-500 underline hover:text-stone-700"
          >
            Enviar outra consulta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <CalendarCheck className="h-10 w-10 text-green-700 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Georgia, serif' }}>
            Sítio Dom Pedro
          </h1>
          <p className="text-stone-500 text-sm mt-1">Verifique a disponibilidade da sua data</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Nome + Telefone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Nome completo *</label>
              <input
                {...register('name')}
                placeholder="Seu nome"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">WhatsApp *</label>
              <input
                {...register('phone')}
                placeholder="(91) 99999-9999"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            </div>
          </div>

          {/* E-mail */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">E-mail</label>
            <input
              {...register('email')}
              type="email"
              placeholder="seuemail@exemplo.com"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          {/* Data do evento */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Data do evento *</label>
            <Controller
              name="event_date"
              control={control}
              render={({ field }) => (
                <DateInput
                  value={field.value}
                  onChange={(iso) => field.onChange(iso ?? '')}
                  placeholder="DD/MM/AAAA"
                  className="w-full"
                />
              )}
            />
            {errors.event_date && (
              <p className="text-xs text-red-600">{errors.event_date.message}</p>
            )}
          </div>

          {/* Tipo + Convidados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Tipo de evento</label>
              <select
                {...register('event_type')}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="casamento">Casamento</option>
                <option value="corporativo">Corporativo</option>
                <option value="debutante">Debutante</option>
                <option value="religioso">Religioso</option>
                <option value="aniversario">Aniversário</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Nº de convidados</label>
              <input
                {...register('guest_count')}
                type="number"
                min={1}
                placeholder="Ex: 150"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          {/* Orçamento + Como nos encontrou */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Orçamento estimado (R$)</label>
              <input
                {...register('budget')}
                type="number"
                min={0}
                placeholder="Ex: 20000"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Como nos encontrou?</label>
              <select
                {...register('source_channel')}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="formulario">Site</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="indicacao">Indicação</option>
                <option value="qr_code">QR Code</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Observações</label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Detalhes sobre o evento, dúvidas..."
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>

          {/* LGPD */}
          <div className="flex items-start gap-3">
            <input
              {...register('consent_lgpd')}
              type="checkbox"
              id="consent"
              className="mt-0.5 h-4 w-4 accent-green-700"
            />
            <label htmlFor="consent" className="text-xs text-stone-500 leading-relaxed">
              Concordo que o Sítio Dom Pedro armazene meus dados para contato referente a este
              evento, conforme a{' '}
              <span className="text-green-700 underline cursor-pointer">
                Política de Privacidade
              </span>
              . *
            </label>
          </div>
          {errors.consent_lgpd && (
            <p className="text-xs text-red-600">{errors.consent_lgpd.message}</p>
          )}

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-medium py-2.5 rounded-md text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Verificando...' : 'Verificar disponibilidade'}
          </button>
        </form>
      </div>
    </div>
  )
}

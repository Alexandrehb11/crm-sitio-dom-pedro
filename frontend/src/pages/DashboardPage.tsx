import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Users, Calendar, TrendingUp, Banknote, MapPin,
  Flame, Thermometer, Snowflake, ArrowRight, CheckCircle2,
  Star, CreditCard,
} from 'lucide-react'

const FUNNEL_LABELS: Record<string, string> = {
  lead: 'Lead',
  visita_agendada: 'Visita Agendada',
  proposta_enviada: 'Proposta Enviada',
  contrato_assinado: 'Contrato Assinado',
  evento_realizado: 'Evento Realizado',
}

const FUNNEL_ORDER = [
  'lead',
  'visita_agendada',
  'proposta_enviada',
  'contrato_assinado',
  'evento_realizado',
]

// ── Componente: linha de detalhe dentro do card ────────────────────────────
function KpiDetail({
  icon,
  label,
  value,
  color = 'text-muted-foreground',
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        {label}
      </span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}

// ── Componente: botão "Ver todos" ──────────────────────────────────────────
function ViewAllButton({ to, label = 'Ver todos' }: { to: string; label?: string }) {
  const navigate = useNavigate()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full mt-3 text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
      onClick={() => navigate(to)}
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </Button>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: dashboardApi.kpis,
    refetchInterval: 60_000,
  })

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['dashboard', 'funnel'],
    queryFn: dashboardApi.funnel,
    refetchInterval: 60_000,
  })

  const { data: calendar, isLoading: calendarLoading } = useQuery({
    queryKey: ['dashboard', 'calendar'],
    queryFn: () => dashboardApi.calendar(30),
    refetchInterval: 60_000,
  })

  const sortedFunnel = funnel
    ? [...funnel].sort(
        (a, b) => FUNNEL_ORDER.indexOf(a.stage) - FUNNEL_ORDER.indexOf(b.stage),
      )
    : []

  const maxFunnelCount = sortedFunnel.reduce((max, s) => Math.max(max, s.count), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do CRM — Sítio Dom Pedro</p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Total de Leads */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="text-4xl font-bold tracking-tight mb-3">
                  {kpis?.leads.total ?? 0}
                </div>
                <div className="space-y-1.5 flex-1">
                  <KpiDetail
                    icon={<Flame className="h-3.5 w-3.5" />}
                    label="quentes"
                    value={kpis?.leads.quentes ?? 0}
                    color="text-red-500"
                  />
                  <KpiDetail
                    icon={<Thermometer className="h-3.5 w-3.5" />}
                    label="mornos"
                    value={kpis?.leads.mornos ?? 0}
                    color="text-amber-500"
                  />
                  <KpiDetail
                    icon={<Snowflake className="h-3.5 w-3.5" />}
                    label="frios"
                    value={kpis?.leads.frios ?? 0}
                    color="text-blue-400"
                  />
                </div>
                <ViewAllButton to="/leads" label="Ver leads" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Eventos Confirmados */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eventos Confirmados</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="text-4xl font-bold tracking-tight mb-3">
                  {kpis?.eventos.confirmados ?? 0}
                </div>
                <div className="space-y-1.5 flex-1">
                  <KpiDetail
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    label="realizados"
                    value={kpis?.eventos.realizados ?? 0}
                    color="text-green-600"
                  />
                </div>
                <ViewAllButton to="/events" label="Ver agenda" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Eventos Realizados */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eventos Realizados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="text-4xl font-bold tracking-tight mb-3">
                  {kpis?.eventos.realizados ?? 0}
                </div>
                <div className="space-y-1.5 flex-1">
                  <KpiDetail
                    icon={<Star className="h-3.5 w-3.5" />}
                    label="confirmados aguardando"
                    value={kpis?.eventos.confirmados ?? 0}
                    color="text-amber-500"
                  />
                </div>
                <ViewAllButton to="/events" label="Ver agenda" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Receita */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold tracking-tight mb-3">
                  {formatCurrency(kpis?.receita.confirmada ?? 0)}
                </div>
                <div className="space-y-1.5 flex-1">
                  <KpiDetail
                    icon={<CreditCard className="h-3.5 w-3.5" />}
                    label="pendente"
                    value={`+ ${formatCurrency(kpis?.receita.pendente ?? 0)}`}
                    color="text-amber-500"
                  />
                </div>
                <ViewAllButton to="/payments" label="Ver pagamentos" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Funil de Vendas ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Funil de Vendas</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/leads')}
          >
            Ver leads
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {funnelLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : sortedFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-3">
              {sortedFunnel.map((stage) => {
                const pct = maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0
                return (
                  <div key={stage.stage} className="flex items-center gap-4">
                    <div className="w-40 shrink-0 text-sm font-medium text-right text-muted-foreground">
                      {FUNNEL_LABELS[stage.stage] ?? stage.stage}
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      >
                        <span className="text-xs font-semibold text-primary-foreground">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Próximos Eventos ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Próximos Eventos (30 dias)</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/events')}
          >
            Ver agenda
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {calendarLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !calendar || calendar.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum evento confirmado nos próximos 30 dias.</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/events')}>
                Ver agenda completa
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {calendar.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 rounded-lg border bg-background p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate('/events')}
                >
                  {/* Data */}
                  <div className="shrink-0 text-center bg-primary/10 rounded-md px-3 py-2 min-w-[64px]">
                    <p className="text-xs text-muted-foreground leading-none uppercase">
                      {new Date(event.date_start).toLocaleDateString('pt-BR', { month: 'short' })}
                    </p>
                    <p className="text-2xl font-bold text-primary leading-tight">
                      {new Date(event.date_start).getDate()}
                    </p>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{event.title}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(event.date_start)} — {formatDateTime(event.date_end)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.space}
                      </span>
                      {event.guest_count !== null && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.guest_count} convidados
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Search, List, CalendarDays, ChevronLeft, ChevronRight, CalendarPlus, CalendarX, User, Phone } from 'lucide-react'
import { eventsApi, leadsApi } from '@/lib/api'
import { DateInput } from '@/components/ui/DateInput'
import type { EventOut, EventCreate, EventUpdate, EventStatus } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 10

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'realizado', label: 'Realizado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const STATUS_BADGE: Record<EventStatus, 'steel' | 'green' | 'pine' | 'coral'> = {
  planejamento: 'steel',
  confirmado: 'green',
  realizado: 'pine',
  cancelado: 'coral',
}

const STATUS_BG: Record<EventStatus, string> = {
  planejamento: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  confirmado: 'bg-green-100 text-green-700 hover:bg-green-200',
  realizado: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  cancelado: 'bg-red-100 text-red-700 hover:bg-red-200',
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const eventSchema = z.object({
  lead_id: z.string().min(1, 'Selecione um lead'),
  title: z.string().min(1, 'Título obrigatório'),
  date_start: z.string().min(1, 'Data de início obrigatória'),
  date_end: z.string().min(1, 'Data de fim obrigatória'),
  space: z.string().min(1, 'Espaço obrigatório'),
  guest_count: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['planejamento', 'confirmado', 'realizado', 'cancelado']).optional(),
})

type EventFormValues = z.infer<typeof eventSchema>

function toISO(dateLocal: string) {
  if (!dateLocal) return dateLocal
  return new Date(dateLocal).toISOString()
}

function toLocalDatetime(isoStr: string) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface EventFormProps {
  defaultValues?: Partial<EventFormValues>
  onSubmit: (values: EventFormValues) => Promise<void>
  isEdit?: boolean
}

function EventForm({ defaultValues, onSubmit, isEdit = false }: EventFormProps) {
  const { data: leads } = useQuery({
    queryKey: ['leads', ''],
    queryFn: () => leadsApi.list({ limit: 200 }),
  })

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      lead_id: '',
      title: '',
      date_start: '',
      date_end: '',
      space: '',
      guest_count: '',
      notes: '',
      status: 'planejamento',
      ...defaultValues,
    },
  })

  const { isSubmitting } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <FormField control={form.control} name="lead_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Lead *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {leads?.map(lead => (
                  <SelectItem key={lead.id} value={lead.id}>{lead.name} — {lead.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Título *</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="date_start" render={({ field }) => (
            <FormItem>
              <FormLabel>Início *</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={(iso) => field.onChange(iso ?? '')} includeTime />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="date_end" render={({ field }) => (
            <FormItem>
              <FormLabel>Fim *</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={(iso) => field.onChange(iso ?? '')} includeTime />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="space" render={({ field }) => (
            <FormItem>
              <FormLabel>Espaço *</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="guest_count" render={({ field }) => (
            <FormItem>
              <FormLabel>Nº Convidados</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {isEdit && (
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl><Textarea rows={3} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

interface CalendarViewProps {
  events: EventOut[]
  onEdit: (event: EventOut) => void
}

function CalendarView({ events, onEdit }: CalendarViewProps) {
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const year = monthStart.getFullYear()
  const monthNum = monthStart.getMonth()
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate()
  const firstWeekday = (new Date(year, monthNum, 1).getDay() + 6) % 7 // Mon=0
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventOut[]>()
    for (const ev of events) {
      const d = new Date(ev.date_start)
      if (d.getFullYear() === year && d.getMonth() === monthNum) {
        const day = d.getDate()
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(ev)
      }
    }
    return map
  }, [events, year, monthNum])

  const today = new Date()
  const isToday = (day: number) =>
    today.getDate() === day && today.getMonth() === monthNum && today.getFullYear() === year

  return (
    <div className="rounded-lg border bg-card">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => setMonthStart(new Date(year, monthNum - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">{MONTH_NAMES[monthNum]} {year}</h2>
        <Button variant="ghost" size="icon" onClick={() => setMonthStart(new Date(year, monthNum + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - firstWeekday + 1
          const valid = dayNum >= 1 && dayNum <= daysInMonth
          const dayEvents = valid ? (eventsByDay.get(dayNum) ?? []) : []
          return (
            <div
              key={i}
              className={cn(
                'min-h-[90px] p-1 border-r border-b',
                (i + 1) % 7 === 0 && 'border-r-0',
                !valid && 'bg-muted/20',
              )}
            >
              {valid && (
                <>
                  <span className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                    isToday(dayNum) ? 'bg-primary text-primary-foreground' : 'text-foreground',
                  )}>
                    {dayNum}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => onEdit(ev)}
                        className={cn(
                          'w-full text-left text-xs px-1.5 py-0.5 rounded truncate transition-colors',
                          STATUS_BG[ev.status],
                        )}
                        title={[ev.lead_name, ev.lead_phone, ev.title].filter(Boolean).join(' · ')}
                      >
                        {ev.lead_name ?? ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 3} mais</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function EventsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [createOpen, setCreateOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<EventOut | null>(null)
  const [deleteEvent, setDeleteEvent] = useState<EventOut | null>(null)

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', statusFilter],
    queryFn: () => eventsApi.list({ status: (statusFilter as EventStatus) || undefined, limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (!events) return []
    const q = search.toLowerCase().trim()
    if (!q) return events
    const qDigits = q.replace(/\D/g, '')
    return events.filter(ev =>
      (ev.lead_name ?? '').toLowerCase().includes(q) ||
      (ev.lead_phone ?? '').replace(/\D/g, '').includes(qDigits) ||
      ev.title.toLowerCase().includes(q) ||
      ev.space.toLowerCase().includes(q)
    )
  }, [events, search])

  useEffect(() => { setPage(1) }, [search, statusFilter])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: (body: EventCreate) => eventsApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Evento criado!'); setCreateOpen(false) },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: EventUpdate }) => eventsApi.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Evento atualizado!'); setEditEvent(null) },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eventsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Evento excluído!'); setDeleteEvent(null) },
    onError: (err: Error) => toast.error(err.message),
  })

  const syncMutation = useMutation({
    mutationFn: (id: string) => eventsApi.syncCalendar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Evento sincronizado com Google Calendar!') },
    onError: (err: Error) => toast.error(err.message),
  })

  const unsyncMutation = useMutation({
    mutationFn: (id: string) => eventsApi.unsyncCalendar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Evento removido do Google Calendar.') },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Agenda</h1>
          <p className="text-muted-foreground mt-1">Gerencie os eventos agendados</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Evento
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou título..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="ml-auto flex items-center rounded-md border p-0.5 bg-muted/30">
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1.5 px-2.5"
            onClick={() => setView('list')}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </Button>
          <Button
            variant={view === 'calendar' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1.5 px-2.5"
            onClick={() => setView('calendar')}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendário
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'calendar' ? (
        isLoading ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : (
          <CalendarView events={filtered} onEdit={setEditEvent} />
        )
      ) : (
        /* List view */
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Título / Evento</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Espaço</TableHead>
                <TableHead>Convidados</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    {search ? 'Nenhum evento encontrado para esta busca.' : 'Nenhum evento encontrado.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map(event => (
                  <TableRow key={event.id}>
                    {/* Nome */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {event.lead_name ?? (
                          <span className="text-muted-foreground italic text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    {/* Telefone */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {event.lead_phone
                          ? (() => {
                              const d = event.lead_phone.replace(/\D/g, '')
                              if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
                              if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
                              return event.lead_phone
                            })()
                          : '—'}
                      </div>
                    </TableCell>
                    {/* Título */}
                    <TableCell className="font-medium max-w-[160px]">
                      <span className="truncate block">{event.title}</span>
                    </TableCell>
                    {/* Início */}
                    <TableCell className="text-sm whitespace-nowrap">{formatDateTime(event.date_start)}</TableCell>
                    {/* Espaço */}
                    <TableCell>{event.space}</TableCell>
                    {/* Convidados */}
                    <TableCell>{event.guest_count ?? '-'}</TableCell>
                    {/* Status */}
                    <TableCell>
                      <Badge variant={STATUS_BADGE[event.status]}>
                        {STATUS_OPTIONS.find(s => s.value === event.status)?.label ?? event.status}
                      </Badge>
                    </TableCell>
                    {/* Ações */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {event.google_event_id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remover do Google Calendar"
                            className="text-green-600 hover:text-destructive"
                            onClick={() => unsyncMutation.mutate(event.id)}
                            disabled={unsyncMutation.isPending}
                          >
                            <CalendarX className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Sincronizar com Google Calendar"
                            className="text-muted-foreground hover:text-green-600"
                            onClick={() => syncMutation.mutate(event.id)}
                            disabled={syncMutation.isPending}
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setEditEvent(event)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteEvent(event)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </div>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
          <EventForm onSubmit={async (v) => {
            await createMutation.mutateAsync({
              lead_id: v.lead_id,
              title: v.title,
              date_start: toISO(v.date_start),
              date_end: toISO(v.date_end),
              space: v.space,
              guest_count: v.guest_count ? parseInt(v.guest_count) : undefined,
              notes: v.notes?.trim() || undefined,
            })
          }} />
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editEvent} onOpenChange={open => !open && setEditEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar Evento</DialogTitle></DialogHeader>
          {editEvent && (
            <EventForm isEdit defaultValues={{
              lead_id: editEvent.lead_id,
              title: editEvent.title,
              date_start: toLocalDatetime(editEvent.date_start),
              date_end: toLocalDatetime(editEvent.date_end),
              space: editEvent.space,
              guest_count: editEvent.guest_count != null ? String(editEvent.guest_count) : '',
              notes: editEvent.notes ?? '',
              status: editEvent.status,
            }}
            onSubmit={async (v) => {
              await updateMutation.mutateAsync({
                id: editEvent.id,
                body: {
                  title: v.title,
                  date_start: toISO(v.date_start),
                  date_end: toISO(v.date_end),
                  space: v.space,
                  guest_count: v.guest_count ? parseInt(v.guest_count) : undefined,
                  notes: v.notes?.trim() || undefined,
                  status: v.status,
                },
              })
            }} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteEvent} onOpenChange={open => !open && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o evento de{' '}
              <strong>{deleteEvent?.lead_name ?? deleteEvent?.title}</strong>
              {deleteEvent?.lead_name && <span className="text-muted-foreground"> — {deleteEvent.title}</span>}?
              {' '}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEvent && deleteMutation.mutate(deleteEvent.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

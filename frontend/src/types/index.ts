// Auth
export interface UserOut {
  id: string
  username: string
  role: string
  is_active: boolean
  created_at: string
}

export interface UserCreate {
  username: string
  password: string
  role: 'admin' | 'vendedor'
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserOut
}

// Dashboard
export interface DashboardKpis {
  leads: {
    total: number
    quentes: number
    mornos: number
    frios: number
  }
  eventos: {
    confirmados: number
    realizados: number
  }
  receita: {
    confirmada: number
    pendente: number
  }
}

export interface FunnelStage {
  stage: string
  count: number
}

export interface CalendarEvent {
  id: string
  title: string
  date_start: string
  date_end: string
  space: string
  guest_count: number | null
}

// Leads
export type EventType =
  | 'casamento'
  | 'corporativo'
  | 'debutante'
  | 'religioso'
  | 'aniversario'
  | 'outro'

export type SourceChannel =
  | 'formulario'
  | 'chatbot'
  | 'whatsapp'
  | 'qr_code'
  | 'indicacao'
  | 'instagram'
  | 'outro'

export type FunnelStageType =
  | 'lead'
  | 'visita_agendada'
  | 'proposta_enviada'
  | 'contrato_assinado'
  | 'evento_realizado'

export interface LeadOut {
  id: string
  name: string
  phone: string
  email: string | null
  event_date: string | null
  event_date_alt: string | null
  event_type: EventType
  guest_count: number | null
  budget: number | null
  source_channel: SourceChannel
  score: number
  funnel_stage: FunnelStageType
  notes: string | null
  consent_lgpd: boolean
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  created_at: string
  updated_at: string
}

export interface LeadCreate {
  name: string
  phone: string
  email?: string
  event_date?: string
  event_date_alt?: string
  event_type: EventType
  guest_count?: number
  budget?: number
  source_channel: SourceChannel
  notes?: string
  consent_lgpd: boolean
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export interface LeadUpdate {
  name?: string
  phone?: string
  email?: string
  event_date?: string
  event_date_alt?: string
  event_type?: EventType
  guest_count?: number
  budget?: number
  source_channel?: SourceChannel
  notes?: string
  consent_lgpd?: boolean
  funnel_stage?: FunnelStageType
}

// Events
export type EventStatus =
  | 'planejamento'
  | 'confirmado'
  | 'realizado'
  | 'cancelado'

export interface EventOut {
  id: string
  lead_id: string
  lead_name: string | null
  lead_phone: string | null
  title: string
  date_start: string
  date_end: string
  space: string
  guest_count: number | null
  status: EventStatus
  notes: string | null
  google_event_id: string | null
  created_at: string
  updated_at: string
}

export interface EventCreate {
  lead_id: string
  title: string
  date_start: string
  date_end: string
  space: string
  guest_count?: number
  notes?: string
}

export interface EventUpdate {
  lead_id?: string
  title?: string
  date_start?: string
  date_end?: string
  space?: string
  guest_count?: number
  status?: EventStatus
  notes?: string
}

// Payments
export type PaymentMethod = 'pix' | 'boleto' | 'cartao'
export type PaymentStatus = 'pendente' | 'pago' | 'vencido' | 'falhou' | 'cancelado'

export interface PaymentOut {
  id: string
  event_id: string
  amount: number
  due_date: string
  method: PaymentMethod
  installment_number: number
  installment_total: number
  status: PaymentStatus
  asaas_id: string | null
  confirmed_at: string | null
  created_at: string
  lead_phone: string | null
  lead_name: string | null
}

export interface PaymentCreate {
  event_id: string
  amount: number
  due_date: string
  method: PaymentMethod
  installment_number?: number
  installment_total?: number
}

export interface PaymentUpdate {
  amount?: number
  due_date?: string
  method?: PaymentMethod
  status?: PaymentStatus
  confirmed_at?: string
}

// Contracts
export type ContractStatus = 'pendente' | 'assinado' | 'executado' | 'cancelado'

export interface ContractOut {
  id: string
  event_id: string
  event_title: string | null
  template_type: string
  client_name: string | null
  client_phone: string | null
  has_pdf: boolean
  signed_by: string | null
  signed_date: string | null
  zapsign_id: string | null
  signed_via: string | null
  status: ContractStatus
  created_at: string
}

export interface ContractCreate {
  event_id: string
  template_type: string
  client_name: string
  client_phone: string
}

export interface ContractUpdate {
  template_type?: string
  client_name?: string
  client_phone?: string
  signed_by?: string
  signed_date?: string
  zapsign_id?: string
  signed_via?: string
  status?: ContractStatus
}

// Message Templates
export interface MessageTemplateOut {
  id: string
  key: string
  title: string
  body: string
  flow: string
  trigger: string
  channel: string
  variables: string | null   // JSON array string, e.g. '["nome","valor"]'
  is_active: boolean
  updated_at: string
}

export interface MessageTemplateUpdate {
  body?: string
  is_active?: boolean
}

// Providers
export interface ProviderOut {
  id: string
  name: string
  category: string
  contact_name: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export interface ProviderCreate {
  name: string
  category: string
  contact_name?: string
  phone?: string
  whatsapp?: string
  email?: string
  notes?: string
}

export interface ProviderUpdate {
  name?: string
  category?: string
  contact_name?: string
  phone?: string
  whatsapp?: string
  email?: string
  notes?: string
}

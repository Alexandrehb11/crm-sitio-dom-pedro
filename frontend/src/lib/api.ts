import type {
  LoginResponse,
  UserOut,
  UserCreate,
  DashboardKpis,
  FunnelStage,
  CalendarEvent,
  LeadOut,
  LeadCreate,
  LeadUpdate,
  EventOut,
  EventCreate,
  EventUpdate,
  PaymentOut,
  PaymentCreate,
  PaymentUpdate,
  ContractOut,
  ContractCreate,
  ContractUpdate,
  ProviderOut,
  ProviderCreate,
  ProviderUpdate,
  MessageTemplateOut,
  MessageTemplateUpdate,
} from '@/types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request<T>(
  method: string,
  path: string,
  options?: {
    body?: unknown
    params?: Record<string, string | number | undefined>
    formData?: boolean
  },
): Promise<T> {
  const token = localStorage.getItem('crm_token')

  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let url = `${API_BASE}${path}`

  if (options?.params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    if (qs) url = `${url}?${qs}`
  }

  let bodyContent: string | URLSearchParams | undefined
  if (options?.body !== undefined) {
    if (options.formData) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(options.body as Record<string, string>)) {
        params.set(key, value)
      }
      bodyContent = params
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    } else {
      bodyContent = JSON.stringify(options.body)
      headers['Content-Type'] = 'application/json'
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: bodyContent,
  })

  if (response.status === 401) {
    localStorage.removeItem('crm_token')
    window.dispatchEvent(new Event('auth:logout'))
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  if (!response.ok) {
    const errorData = data as Record<string, unknown>
    const detail = errorData?.detail
    if (typeof detail === 'string') {
      throw new Error(detail)
    } else if (Array.isArray(detail)) {
      const messages = detail.map((d: Record<string, unknown>) => d.msg ?? JSON.stringify(d))
      throw new Error(messages.join(', '))
    }
    throw new Error(`Erro ${response.status}: ${response.statusText}`)
  }

  return data as T
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    request<LoginResponse>('POST', '/api/auth/login', {
      body: { username, password },
      formData: true,
    }),
  me: () => request<UserOut>('GET', '/api/auth/me'),
}

// Settings (admin only — reads/writes backend .env)
export const settingsApi = {
  get: () => request<{ values: Record<string, string> }>('GET', '/api/settings/'),
  update: (values: Record<string, string>) =>
    request<{ values: Record<string, string> }>('PATCH', '/api/settings/', { body: { values } }),
}

// Webhooks
export const webhooksApi = {
  registerEvolution: (webhook_url: string) =>
    request<{ ok: boolean; webhook_url: string }>('POST', '/api/webhooks/register', {
      body: { webhook_url },
    }),
}

// Users (admin only)
export const usersApi = {
  list: () => request<UserOut[]>('GET', '/api/auth/users'),
  create: (body: UserCreate) => request<UserOut>('POST', '/api/auth/users', { body }),
  deactivate: (id: string) => request<UserOut>('PATCH', `/api/auth/users/${id}/deactivate`),
}

// Dashboard
export const dashboardApi = {
  kpis: () => request<DashboardKpis>('GET', '/api/dashboard/kpis'),
  funnel: () => request<FunnelStage[]>('GET', '/api/dashboard/funnel'),
  calendar: (days = 30) =>
    request<CalendarEvent[]>('GET', '/api/dashboard/calendar', { params: { days } }),
}

// Leads
export const leadsApi = {
  list: (params?: { stage?: string; skip?: number; limit?: number }) =>
    request<LeadOut[]>('GET', '/api/leads/', { params }),
  create: (body: LeadCreate) => request<LeadOut>('POST', '/api/leads/', { body }),
  update: (id: string, body: LeadUpdate) =>
    request<LeadOut>('PATCH', `/api/leads/${id}`, { body }),
  delete: (id: string) => request<void>('DELETE', `/api/leads/${id}`),
}

// Events
export const eventsApi = {
  list: (params?: { status?: string; skip?: number; limit?: number }) =>
    request<EventOut[]>('GET', '/api/events/', { params }),
  create: (body: EventCreate) => request<EventOut>('POST', '/api/events/', { body }),
  update: (id: string, body: EventUpdate) =>
    request<EventOut>('PATCH', `/api/events/${id}`, { body }),
  delete: (id: string) => request<void>('DELETE', `/api/events/${id}`),
  syncCalendar: (id: string) => request<EventOut>('POST', `/api/events/${id}/sync-calendar`),
  unsyncCalendar: (id: string) => request<void>('DELETE', `/api/events/${id}/sync-calendar`),
}

// Payments
export const paymentsApi = {
  list: (params?: { event_id?: string; status?: string; skip?: number; limit?: number }) =>
    request<PaymentOut[]>('GET', '/api/payments/', { params }),
  create: (body: PaymentCreate) => request<PaymentOut>('POST', '/api/payments/', { body }),
  update: (id: string, body: PaymentUpdate) =>
    request<PaymentOut>('PATCH', `/api/payments/${id}`, { body }),
  delete: (id: string) => request<void>('DELETE', `/api/payments/${id}`),
  charge: (id: string) => request<PaymentOut>('POST', `/api/payments/${id}/charge`),
}

// Contracts
export const contractsApi = {
  list: (params?: { event_id?: string; status?: string; search?: string; skip?: number; limit?: number }) =>
    request<ContractOut[]>('GET', '/api/contracts/', { params }),
  create: (body: ContractCreate) => request<ContractOut>('POST', '/api/contracts/', { body }),
  update: (id: string, body: ContractUpdate) =>
    request<ContractOut>('PATCH', `/api/contracts/${id}`, { body }),
  delete: (id: string) => request<void>('DELETE', `/api/contracts/${id}`),
  send: (id: string) => request<ContractOut>('POST', `/api/contracts/${id}/send`),
  removePdf: (id: string) => request<ContractOut>('DELETE', `/api/contracts/${id}/attach-pdf`),
  /**
   * Baixa o PDF com autenticação JWT e abre em nova aba via Blob URL.
   * Retorna a URL do blob para que o chamador possa revogá-la depois se quiser.
   */
  openPdf: async (id: string): Promise<void> => {
    const token = localStorage.getItem('crm_token')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const response = await fetch(`${API_BASE}/api/contracts/${id}/template-pdf`, { headers })
    if (response.status === 401) {
      localStorage.removeItem('crm_token')
      window.dispatchEvent(new Event('auth:logout'))
      throw new Error('Sessão expirada. Faça login novamente.')
    }
    if (!response.ok) {
      const text = await response.text()
      let detail = `Erro ${response.status}`
      try { detail = (JSON.parse(text) as Record<string, string>).detail ?? detail } catch { /* ignore */ }
      throw new Error(detail)
    }
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, '_blank')
    // Aguarda o navegador carregar e revoga o Blob URL para liberar memória
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
    if (!win) throw new Error('Pop-up bloqueado. Permita pop-ups para este site.')
  },
  attachPdf: async (id: string, file: File): Promise<ContractOut> => {
    const token = localStorage.getItem('crm_token')
    const formData = new FormData()
    formData.append('file', file)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const response = await fetch(`${API_BASE}/api/contracts/${id}/attach-pdf`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (response.status === 401) {
      localStorage.removeItem('crm_token')
      window.dispatchEvent(new Event('auth:logout'))
      throw new Error('Sessão expirada. Faça login novamente.')
    }
    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }
    if (!response.ok) {
      const errorData = data as Record<string, unknown>
      const detail = errorData?.detail
      if (typeof detail === 'string') throw new Error(detail)
      throw new Error(`Erro ${response.status}: ${response.statusText}`)
    }
    return data as ContractOut
  },
}

// Message Templates
export const messagesApi = {
  list: () => request<MessageTemplateOut[]>('GET', '/api/messages/'),
  update: (id: string, body: MessageTemplateUpdate) =>
    request<MessageTemplateOut>('PATCH', `/api/messages/${id}`, { body }),
}

// Providers
export const providersApi = {
  list: (params?: { category?: string; skip?: number; limit?: number }) =>
    request<ProviderOut[]>('GET', '/api/providers/', { params }),
  create: (body: ProviderCreate) => request<ProviderOut>('POST', '/api/providers/', { body }),
  update: (id: string, body: ProviderUpdate) =>
    request<ProviderOut>('PATCH', `/api/providers/${id}`, { body }),
  delete: (id: string) => request<void>('DELETE', `/api/providers/${id}`),
}

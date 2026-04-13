from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import contracts, events, leads, payments, providers
from app.api import auth, dashboard, webhooks, settings, message_templates


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Semeia templates padrão se a tabela estiver vazia (falha silenciosa)
    try:
        from app.services.template_seed import seed_message_templates
        seed_message_templates()
    except Exception:
        pass
    yield


app = FastAPI(
    title="CRM Sítio Dom Pedro",
    version="1.0.0",
    description="Sistema de CRM para espaço de eventos — agendamento, automação e gestão de leads",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
app.include_router(events.router, prefix="/api/events", tags=["Eventos"])
app.include_router(payments.router, prefix="/api/payments", tags=["Pagamentos"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["Contratos"])
app.include_router(providers.router, prefix="/api/providers", tags=["Fornecedores"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(message_templates.router, prefix="/api/messages", tags=["Mensagens"])


@app.get("/health")
def health_check():
    return {"status": "ok"}

"""
Script de seed — cria o usuário admin inicial e dados de exemplo.

Uso:
    python -m app.seed
    python -m app.seed --username admin --password SenhaSeg123
    python -m app.seed --demo          # cria contrato de exemplo
"""

import argparse
import base64
from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import User, UserRole


def create_admin(username: str, password: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"Usuário '{username}' já existe.")
            return
        user = User(
            username=username,
            hashed_password=hash_password(password),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Admin '{username}' criado com sucesso.")
    finally:
        db.close()


# ── PDF mínimo válido para teste ─────────────────────────────────────────────

def _make_sample_pdf_base64() -> str:
    """Gera um PDF mínimo válido com texto de contrato de exemplo."""

    page_content: bytes = (
        b"BT\n"
        b"/F1 14 Tf\n"
        b"50 800 Td\n"
        b"(CONTRATO DE LOCACAO DE ESPACO PARA EVENTOS) Tj\n"
        b"0 -30 Td\n"
        b"/F1 11 Tf\n"
        b"(Sitio Dom Pedro - Modelo de Contrato para Teste) Tj\n"
        b"0 -20 Td\n"
        b"(Substituir pelo contrato real antes de usar em producao.) Tj\n"
        b"0 -50 Td\n"
        b"(CONTRATANTE: _________________________________) Tj\n"
        b"0 -20 Td\n"
        b"(CPF/CNPJ: ______________  Tel: ______________) Tj\n"
        b"0 -50 Td\n"
        b"(DATA DO EVENTO: ___/___/______) Tj\n"
        b"0 -20 Td\n"
        b"(HORARIO: ____h as ____h) Tj\n"
        b"0 -20 Td\n"
        b"(N. CONVIDADOS: ______) Tj\n"
        b"0 -50 Td\n"
        b"(VALOR TOTAL: R$ _______________) Tj\n"
        b"0 -20 Td\n"
        b"(SINAL: R$ ___________ SALDO: R$ ___________) Tj\n"
        b"0 -80 Td\n"
        b"(Assinatura Contratante: ___________________________) Tj\n"
        b"0 -30 Td\n"
        b"(Assinatura Sitio Dom Pedro: _______________________) Tj\n"
        b"ET\n"
    )

    chunks: list[bytes] = []
    offsets: list[int] = []
    pos = 0

    def add(data: bytes) -> None:
        nonlocal pos
        chunks.append(data)
        pos += len(data)

    def mark() -> None:
        offsets.append(pos)

    add(b"%PDF-1.4\n")

    mark()
    add(b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n")

    mark()
    add(b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n")

    mark()
    add(
        b"3 0 obj\n"
        b"<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n"
        b"/Resources <</Font <</F1 5 0 R>>>>\n"
        b"/Contents 4 0 R>>\n"
        b"endobj\n"
    )

    mark()
    stream_len = len(page_content)
    add(b"4 0 obj\n<</Length " + str(stream_len).encode() + b">>\nstream\n")
    add(page_content)
    add(b"endstream\nendobj\n")

    mark()
    add(b"5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n")

    xref_pos = pos
    add(b"xref\n0 6\n0000000000 65535 f \n")
    for o in offsets:
        add(f"{o:010d} 00000 n \n".encode())

    add(f"trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n{xref_pos}\n%%EOF\n".encode())

    pdf_bytes = b"".join(chunks)
    return base64.b64encode(pdf_bytes).decode("ascii")


# ── Seed de dados de exemplo ──────────────────────────────────────────────────

def create_demo(force: bool = False) -> None:
    """
    Cria lead, evento e contrato de exemplo para teste do fluxo de assinatura.
    """
    from app.models.contract import Contract, ContractStatus
    from app.models.event import Event, EventStatus
    from app.models.lead import Lead

    db = SessionLocal()
    try:
        # ── Lead ──
        lead = db.query(Lead).filter(Lead.phone == "11999998888").first()
        if not lead:
            lead = Lead(
                name="João Silva (Exemplo)",
                phone="11999998888",
                email="joao.silva@exemplo.com.br",
                event_type="casamento",
                source_channel="formulario",
                guest_count=150,
                budget=25000.0,
                consent_lgpd=True,
                score=75,
                funnel_stage="proposta_enviada",
                notes="Lead de exemplo criado pelo seed. Pode ser excluído.",
            )
            db.add(lead)
            db.flush()
            print(f"Lead de exemplo criado: {lead.name} (id={lead.id})")
        else:
            print(f"Lead de exemplo já existe: {lead.name}")

        # ── Evento ──
        event = db.query(Event).filter(Event.lead_id == lead.id).first()
        if not event:
            next_saturday = datetime.now() + timedelta(days=(5 - datetime.now().weekday() + 7) % 7 + 7)
            event_start = next_saturday.replace(hour=16, minute=0, second=0, microsecond=0)
            event = Event(
                lead_id=lead.id,
                title="Casamento João e Maria — Exemplo",
                date_start=event_start,
                date_end=event_start + timedelta(hours=6),
                space="Salão Principal",
                guest_count=150,
                status=EventStatus.planejamento,
                notes="Evento de exemplo criado pelo seed.",
            )
            db.add(event)
            db.flush()
            print(f"Evento de exemplo criado: {event.title} (id={event.id})")
        else:
            print(f"Evento de exemplo já existe: {event.title}")

        # ── Contrato ──
        existing_contract = db.query(Contract).filter(
            Contract.event_id == event.id
        ).first()
        if not existing_contract or force:
            pdf_b64 = _make_sample_pdf_base64()
            contract = Contract(
                event_id=event.id,
                template_type="Casamento — Padrão",
                client_name=lead.name,
                client_phone=lead.phone,
                pdf_template_base64=pdf_b64,
                status=ContractStatus.pendente,
            )
            db.add(contract)
            db.commit()
            print(
                f"Contrato de exemplo criado!\n"
                f"  Cliente: {contract.client_name}\n"
                f"  Telefone: {contract.client_phone}\n"
                f"  Template: {contract.template_type}\n"
                f"  PDF gerado: {len(pdf_b64)} chars base64\n"
                f"  Status: {contract.status}\n"
                f"  Para enviar via ZapSign: configure ZAPSIGN_API_TOKEN no painel\n"
                f"  e clique em 'Enviar' na página de Contratos."
            )
        else:
            db.commit()
            print(f"Contrato de exemplo já existe para o evento '{event.title}'")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed do CRM — Sítio Dom Pedro")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="admin123")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Cria lead, evento e contrato de exemplo para teste",
    )
    parser.add_argument(
        "--force-demo",
        action="store_true",
        help="Recria o contrato de exemplo mesmo que já exista",
    )
    args = parser.parse_args()

    create_admin(args.username, args.password)
    if args.demo or args.force_demo:
        create_demo(force=args.force_demo)

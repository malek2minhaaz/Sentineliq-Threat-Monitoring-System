"""SentinalIQ - Database Models"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
import json

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, create_engine
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///sentinaliq.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


# ─── User ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="analyst")
    avatar = Column(String, default="")
    created_at = Column(DateTime, default=utcnow)
    is_verified = Column(Boolean, default=False)
    theme = Column(String, default="dark")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "role": self.role,
            "avatar": self.avatar,
            "created_at": self.created_at.isoformat(),
            "is_verified": self.is_verified,
            "theme": self.theme,
        }


# ─── Incident ───────────────────────────────────────────────────────────────

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    severity = Column(String, default="medium")  # critical, high, medium, low
    status = Column(String, default="open")  # open, investigating, resolved, closed
    assignee = Column(String, default="")
    source = Column(String, default="")
    category = Column(String, default="")
    user_id = Column(String, ForeignKey("users.id"), default="")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    resolved_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "status": self.status,
            "assignee": self.assignee,
            "source": self.source,
            "category": self.category,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


# ─── Log / Event ────────────────────────────────────────────────────────────

class LogEvent(Base):
    __tablename__ = "log_events"
    id = Column(String, primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=utcnow)
    source_ip = Column(String, default="")
    event_type = Column(String, default="info")  # info, warning, error, critical
    message = Column(Text, default="")
    source = Column(String, default="")
    user_agent = Column(String, default="")
    endpoint = Column(String, default="")
    raw_data = Column(Text, default="")
    severity = Column(String, default="low")

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "source_ip": self.source_ip,
            "event_type": self.event_type,
            "message": self.message,
            "source": self.source,
            "user_agent": self.user_agent,
            "endpoint": self.endpoint,
            "raw_data": self.raw_data,
            "severity": self.severity,
        }


# ─── Threat / IOC ───────────────────────────────────────────────────────────

class ThreatIntel(Base):
    __tablename__ = "threat_intel"
    id = Column(String, primary_key=True, default=generate_uuid)
    ioc_type = Column(String, nullable=False)  # ip, domain, hash, url, email
    ioc_value = Column(String, nullable=False)
    threat_actor = Column(String, default="")
    malware_family = Column(String, default="")
    confidence = Column(String, default="medium")  # low, medium, high, certain
    severity = Column(String, default="medium")
    description = Column(Text, default="")
    first_seen = Column(DateTime, default=utcnow)
    last_seen = Column(DateTime, default=utcnow)
    tags = Column(Text, default="")  # comma-separated
    source = Column(String, default="")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "ioc_type": self.ioc_type,
            "ioc_value": self.ioc_value,
            "threat_actor": self.threat_actor,
            "malware_family": self.malware_family,
            "confidence": self.confidence,
            "severity": self.severity,
            "description": self.description,
            "first_seen": self.first_seen.isoformat(),
            "last_seen": self.last_seen.isoformat(),
            "tags": self.tags.split(",") if self.tags else [],
            "source": self.source,
            "is_active": self.is_active,
        }


# ─── Endpoint (EDR) ─────────────────────────────────────────────────────────

class Endpoint(Base):
    __tablename__ = "endpoints"
    id = Column(String, primary_key=True, default=generate_uuid)
    hostname = Column(String, nullable=False)
    ip_address = Column(String, default="")
    os = Column(String, default="")
    status = Column(String, default="online")  # online, offline, compromised, maintenance
    agent_version = Column(String, default="")
    last_seen = Column(DateTime, default=utcnow)
    risk_score = Column(Float, default=0.0)
    cpu_usage = Column(Float, default=0.0)
    memory_usage = Column(Float, default=0.0)
    disk_usage = Column(Float, default=0.0)
    running_processes = Column(Integer, default=0)
    alerts_count = Column(Integer, default=0)
    tags = Column(Text, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "hostname": self.hostname,
            "ip_address": self.ip_address,
            "os": self.os,
            "status": self.status,
            "agent_version": self.agent_version,
            "last_seen": self.last_seen.isoformat(),
            "risk_score": self.risk_score,
            "cpu_usage": self.cpu_usage,
            "memory_usage": self.memory_usage,
            "disk_usage": self.disk_usage,
            "running_processes": self.running_processes,
            "alerts_count": self.alerts_count,
            "tags": self.tags.split(",") if self.tags else [],
        }


# ─── WAF Rule ───────────────────────────────────────────────────────────────

class WAFRule(Base):
    __tablename__ = "waf_rules"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    category = Column(String, default="")  # sql-injection, xss, path-traversal, etc.
    action = Column(String, default="block")  # block, log, allow, challenge
    priority = Column(Integer, default=100)
    pattern = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    hits = Column(Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "action": self.action,
            "priority": self.priority,
            "pattern": self.pattern,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "hits": self.hits,
        }


# ─── Ingestion Record (per-user ingestion history) ────────────────────────────────

class IngestionRecord(Base):
    __tablename__ = "ingestion_records"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # url_scan, file_upload
    source = Column(String, default="")  # URL or filename
    file_type = Column(String, default="")  # txt, pdf, json, csv
    records_count = Column(Integer, default=0)
    status = Column(String, default="completed")  # completed, failed
    summary = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "source": self.source,
            "file_type": self.file_type,
            "records_count": self.records_count,
            "status": self.status,
            "summary": self.summary,
            "created_at": self.created_at.isoformat(),
        }


# ─── Dashboard Widget ───────────────────────────────────────────────────────

class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    widget_type = Column(String, nullable=False)
    position = Column(Integer, default=0)
    visible = Column(Boolean, default=True)
    config = Column(Text, default="{}")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "widget_type": self.widget_type,
            "position": self.position,
            "visible": self.visible,
            "config": json.loads(self.config) if self.config else {},
        }


# ─── Notification ───────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, default="")
    category = Column(String, default="alert")  # alert, incident, info
    severity = Column(String, default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    related_id = Column(String, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "message": self.message,
            "category": self.category,
            "severity": self.severity,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
            "related_id": self.related_id,
        }


# ─── Monitor Event (Live Monitoring) ────────────────────────────────────────

class MonitorEvent(Base):
    __tablename__ = "monitor_events"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), default="")
    timestamp = Column(DateTime, default=utcnow)
    event_type = Column(String, nullable=False)  # attack, anomaly, scan, login, injection, xss, brute_force, ddos, info
    severity = Column(String, default="medium")  # critical, high, medium, low, info
    source_ip = Column(String, default="")
    source_country = Column(String, default="Unknown")
    target = Column(String, default="")  # target endpoint/service
    method = Column(String, default="")  # HTTP method or attack method
    path = Column(String, default="")
    user_agent = Column(String, default="")
    payload = Column(Text, default="")
    message = Column(Text, default="")
    status = Column(String, default="blocked")  # blocked, detected, investigating, mitigated
    is_active = Column(Boolean, default=True)
    metadata_json = Column(Text, default="{}")  # additional JSON data

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "severity": self.severity,
            "source_ip": self.source_ip,
            "source_country": self.source_country,
            "target": self.target,
            "method": self.method,
            "path": self.path,
            "user_agent": self.user_agent,
            "payload": self.payload,
            "message": self.message,
            "status": self.status,
            "is_active": self.is_active,
            "metadata_json": json.loads(self.metadata_json) if self.metadata_json else {},
        }


# ─── Website Monitor (URL-based website security monitoring) ──────────────

class WebsiteMonitor(Base):
    __tablename__ = "website_monitors"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    url = Column(String, nullable=False)
    url_hash = Column(String, index=True, nullable=False)  # SHA-like hash for quick lookup
    hostname = Column(String, default="")
    threat_score = Column(Integer, default=0)  # 0-100, higher = more dangerous
    threat_level = Column(String, default="safe")  # safe, low, medium, high, critical
    status = Column(String, default="monitoring")  # monitoring, scanning, under_attack, compromised, clean
    findings = Column(Text, default="[]")  # JSON array of scan findings
    last_scan_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    is_active = Column(Boolean, default=True)
    scan_count = Column(Integer, default=0)
    incident_count = Column(Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "url": self.url,
            "url_hash": self.url_hash,
            "hostname": self.hostname,
            "threat_score": self.threat_score,
            "threat_level": self.threat_level,
            "status": self.status,
            "findings": json.loads(self.findings) if self.findings else [],
            "last_scan_at": self.last_scan_at.isoformat() if self.last_scan_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "is_active": self.is_active,
            "scan_count": self.scan_count,
            "incident_count": self.incident_count,
        }


# ─── Create all ─────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)

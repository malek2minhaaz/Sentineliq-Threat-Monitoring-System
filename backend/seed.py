"""SentinalIQ - Seed Data Generator"""

import random
import uuid
from datetime import datetime, timedelta, timezone

from models import (
    init_db, SessionLocal, User, Incident, LogEvent, ThreatIntel,
    Endpoint, WAFRule, Notification, DashboardWidget
)
from auth import hash_password


def seed_database():
    init_db()
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).first():
        print("Database already seeded. Skipping.")
        db.close()
        return

    utc = timezone.utc
    now = datetime.now(utc)

    # ── Users ───────────────────────────────────────────────────────────────
    users = [
        User(id=str(uuid.uuid4()), email="admin@sentinaliq.io", username="admin",
             hashed_password=hash_password("admin123"), role="admin", is_verified=True),
        User(id=str(uuid.uuid4()), email="analyst@sentinaliq.io", username="analyst",
             hashed_password=hash_password("analyst123"), role="analyst", is_verified=True),
        User(id=str(uuid.uuid4()), email="soc@sentinaliq.io", username="soc_lead",
             hashed_password=hash_password("soc123"), role="soc_lead", is_verified=True),
    ]
    db.add_all(users)
    db.commit()

    # ── Incidents ───────────────────────────────────────────────────────────
    incident_templates = [
        ("Ransomware outbreak detected on finance servers", "critical",
         "Multiple endpoints showing ransom notes. Rapid containment required.", "Ransomware", "Sigma Rule"),
        ("Suspicious lateral movement from compromised workstation", "high",
         "Anomalous RDP connections from workstation WKS-042 to domain controllers.", "Lateral Movement", "EDR Alert"),
        ("Phishing campaign targeting HR department", "medium",
         "Employees reporting suspicious emails containing fake payroll links.", "Phishing", "Email Gateway"),
        ("SQL injection attempt on customer portal", "high",
         "WAF blocked SQLi attempts targeting /api/customers endpoints.", "Web Attack", "WAF"),
        ("Brute force detected on SSH servers", "medium",
         "Multiple failed SSH attempts from 45 foreign IP addresses.", "Brute Force", "IDS"),
        ("Data exfiltration via DNS tunneling", "high",
         "Unusual DNS query patterns detected from database server DB-03.", "Exfiltration", "NSM"),
        ("Unauthorized access to S3 bucket", "critical",
         "Sensitive customer data bucket accessed from unrecognized IP range.", "Cloud Security", "CSPM"),
        ("DDoS attack on public-facing web servers", "medium",
         "Traffic surge to web servers from distributed botnet.", "DDoS", "Network Monitor"),
        ("Zero-day exploit detected in web framework", "critical",
         "Exploitation attempts for CVE-2026-XXXX detected in wild.", "Zero-Day", "Threat Intel"),
        ("Insider threat: abnormal database queries", "low",
         "Employee running large data exports outside normal hours.", "Insider Threat", "UEBA"),
    ]

    statuses = ["open", "investigating", "resolved", "closed"]
    assignees = ["admin", "analyst", "soc_lead", "jdoe", "asmith", ""]

    for i, (title, severity, desc, source, category) in enumerate(incident_templates):
        created = now - timedelta(hours=random.randint(1, 240), minutes=random.randint(0, 59))
        status = random.choice(statuses)
        resolved_at = created + timedelta(hours=random.randint(2, 48)) if status == "resolved" else None
        incident = Incident(
            id=str(uuid.uuid4()),
            title=title,
            description=desc,
            severity=severity,
            status=status,
            assignee=random.choice(assignees),
            source=source,
            category=category,
            created_at=created,
            updated_at=created + timedelta(hours=random.randint(1, 48)),
            resolved_at=resolved_at,
        )
        db.add(incident)
    db.commit()

    # ── Log Events ──────────────────────────────────────────────────────────
    event_types = ["info", "warning", "error", "critical"]
    sources = ["web-server", "database", "firewall", "endpoint", "email-gw", "dns", "ids"]
    messages = [
        "User login successful from {ip}",
        "Failed login attempt from {ip}",
        "Connection timeout on port 443",
        "File integrity change detected on /etc/passwd",
        "New process spawned: powershell.exe -enc",
        "DNS query to known malware domain: {domain}",
        "Firewall rule triggered for inbound traffic",
        "Suspicious email attachment detected",
        "Port scan detected from {ip}",
        "Certificate expiring in 7 days",
        "Database query exceeding threshold",
        "API rate limit exceeded from {ip}",
        "New SSH key added to authorized_keys",
        "Windows event 4625: account login failure",
        "Memory usage above 90% on server {host}",
    ]
    domains = ["evil.example.com", "malware.test", "phish.xyz", "badhost.net", "c2server.io"]
    hosts = ["SRV-WEB-01", "SRV-DB-01", "SRV-APP-01", "WKS-042", "DC-01"]
    ips = [f"10.0.{random.randint(0, 255)}.{random.randint(1, 254)}" for _ in range(20)]

    for i in range(500):
        created = now - timedelta(
            hours=random.randint(0, 72),
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59)
        )
        ip = random.choice(ips)
        message = random.choice(messages).format(
            ip=ip, domain=random.choice(domains), host=random.choice(hosts)
        )
        event = LogEvent(
            id=str(uuid.uuid4()),
            timestamp=created,
            source_ip=ip,
            event_type=random.choice(event_types),
            message=message,
            source=random.choice(sources),
            user_agent="Mozilla/5.0" if random.random() > 0.5 else "",
            endpoint=f"/api/{random.choice(['auth', 'data', 'admin', 'users', 'config'])}",
            severity=random.choice(["low", "medium", "high", "critical"]),
        )
        db.add(event)
    db.commit()

    # ── Threat Intel / IOCs ─────────────────────────────────────────────────
    threat_actors = ["APT29", "Lazarus Group", "FIN7", "TA505", "UNC1878", "Kimsuky", "APT41"]
    malware_families = ["Emotet", "Cobalt Strike", "TrickBot", "Ryuk", "Conti", "BlackCat", "LockBit"]

    iocs = [
        ("ip", "185.234.72.18"), ("ip", "103.235.46.92"), ("ip", "45.33.22.11"),
        ("ip", "91.121.87.34"), ("ip", "198.51.100.73"),
        ("domain", "evilcorp-c2.net"), ("domain", "malware-tracker.xyz"),
        ("domain", "phish-kit.io"), ("domain", "ransomware-payload.biz"),
        ("domain", "apt-c2-server.com"),
        ("hash", "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"),
        ("hash", "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1"),
        ("hash", "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2"),
        ("hash", "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3"),
        ("url", "https://evilcorp.net/payload.exe"),
        ("url", "https://phish-campaign.com/login"),
        ("url", "https://malware-tracker.xyz/download"),
        ("email", "phisher@evilcorp.net"),
        ("email", "spam@malware-tracker.xyz"),
        ("email", "noreply@phish-bank.com"),
    ]

    for ioc_type, ioc_value in iocs:
        confidence = random.choice(["low", "medium", "high", "certain"])
        severity = random.choice(["low", "medium", "high", "critical"])
        threat = ThreatIntel(
            id=str(uuid.uuid4()),
            ioc_type=ioc_type,
            ioc_value=ioc_value,
            threat_actor=random.choice(threat_actors),
            malware_family=random.choice(malware_families),
            confidence=confidence,
            severity=severity,
            description=f"{ioc_type.upper()} indicator associated with {random.choice(threat_actors)} activity.",
            first_seen=now - timedelta(days=random.randint(1, 90)),
            last_seen=now - timedelta(hours=random.randint(1, 72)),
            tags="malware,c2,apt",
            source="AlienVault OTX",
        )
        db.add(threat)
    db.commit()

    # ── Endpoints ───────────────────────────────────────────────────────────
    endpoint_data = [
        ("SRV-WEB-01", "10.0.1.10", "Linux Ubuntu 22.04", 15.2, 42.1, 55.0, 234, 3),
        ("SRV-APP-01", "10.0.1.11", "Linux Ubuntu 22.04", 45.8, 67.3, 72.0, 189, 5),
        ("SRV-DB-01", "10.0.1.12", "Linux Ubuntu 22.04", 72.1, 81.5, 88.0, 145, 8),
        ("DC-01", "10.0.0.10", "Windows Server 2022", 22.4, 54.2, 45.0, 312, 2),
        ("WKS-042", "10.0.2.42", "Windows 11 Pro", 34.7, 62.8, 41.0, 87, 12),
        ("WKS-015", "10.0.2.15", "Windows 11 Pro", 8.3, 31.2, 29.0, 56, 1),
        ("FW-01", "10.0.255.1", "Fortinet FortiOS 7.4", 12.5, 38.9, 30.0, 0, 4),
        ("EDR-SRV-01", "10.0.3.5", "Linux Ubuntu 22.04", 28.1, 44.7, 52.0, 67, 0),
    ]

    statuses_endpoint = ["online", "online", "online", "online", "compromised", "online", "online", "maintenance"]

    for i, (hostname, ip, os, cpu, mem, disk, procs, alerts) in enumerate(endpoint_data):
        endpoint = Endpoint(
            id=str(uuid.uuid4()),
            hostname=hostname,
            ip_address=ip,
            os=os,
            status=statuses_endpoint[i],
            agent_version="4.2.1",
            last_seen=now - timedelta(minutes=random.randint(1, 30)),
            risk_score=random.uniform(0, 100),
            cpu_usage=cpu,
            memory_usage=mem,
            disk_usage=disk,
            running_processes=procs,
            alerts_count=alerts,
            tags="production,monitored" if i < 5 else "development",
        )
        db.add(endpoint)
    db.commit()

    # ── WAF Rules ───────────────────────────────────────────────────────────
    waf_rules = [
        ("Block SQL Injection", "Blocks common SQL injection patterns", "sql-injection", "block", 10),
        ("Block XSS", "Blocks cross-site scripting attempts", "xss", "block", 20),
        ("Block Path Traversal", "Blocks directory traversal attacks", "path-traversal", "block", 30),
        ("Rate Limit API", "Rate limits API endpoints", "rate-limit", "block", 40),
        ("Allow Internal IPs", "Whitelists internal IP ranges", "whitelist", "allow", 5),
        ("Block Command Injection", "Blocks OS command injection", "command-injection", "block", 25),
        ("Log All Requests", "Logs all HTTP requests for analysis", "monitoring", "log", 100),
        ("Challenge Suspicious UA", "CAPTCHA challenge for suspicious user agents", "bot-detection", "challenge", 50),
        ("Block known bad IPs", "Blocks traffic from known malicious IPs", "ip-reputation", "block", 1),
        ("Block file upload exploits", "Blocks malicious file uploads", "file-upload", "block", 35),
    ]

    for name, desc, category, action, priority in waf_rules:
        rule = WAFRule(
            id=str(uuid.uuid4()),
            name=name,
            description=desc,
            category=category,
            action=action,
            priority=priority,
            pattern=f"rule_{category}_{priority}",
            is_active=True,
            created_at=now - timedelta(days=random.randint(1, 60)),
            hits=random.randint(0, 5000),
        )
        db.add(rule)
    db.commit()

    # ── Notifications ───────────────────────────────────────────────────────
    for user in users:
        for i in range(5):
            created = now - timedelta(hours=random.randint(1, 48))
            sev = random.choice(["critical", "high", "medium", "low", "info"])
            notif = Notification(
                id=str(uuid.uuid4()),
                user_id=user.id,
                title=f"{sev.title()} severity alert: {random.choice(incident_templates)[0][:40]}",
                message=f"Action required. {sev.title()} severity event detected.",
                category=random.choice(["alert", "incident", "info"]),
                severity=sev,
                is_read=random.random() < 0.3,
                created_at=created,
                related_id="",
            )
            db.add(notif)
    db.commit()

    # ── Dashboard Widgets ───────────────────────────────────────────────────
    widget_types = ["stat-cards", "attack-vector-chart", "severity-breakdown",
                     "endpoint-health", "incident-timeline", "live-activity"]
    for user in users:
        for i, wt in enumerate(widget_types):
            widget = DashboardWidget(
                id=str(uuid.uuid4()),
                user_id=user.id,
                widget_type=wt,
                position=i,
                visible=True,
                config='{}',
            )
            db.add(widget)
    db.commit()

    print(f"Database seeded successfully!")
    print(f"  Users: {len(users)}")
    print(f"  Incidents: {len(incident_templates)}")
    print(f"  Log Events: 500")
    print(f"  Threat IOCs: {len(iocs)}")
    print(f"  Endpoints: {len(endpoint_data)}")
    print(f"  WAF Rules: {len(waf_rules)}")
    print(f"  Notifications: {len(users) * 5}")
    db.close()


if __name__ == "__main__":
    seed_database()

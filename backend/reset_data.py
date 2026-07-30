#!/usr/bin/env python3
"""
SentinalIQ - Data Reset Script
================================
Clears all scrap/test data from the database while preserving user accounts.
This fixes the issue of seeing data from all users.

Usage:
  python reset_data.py           # Clear all scrap data
  python reset_data.py --hard    # Delete database file entirely (resets everything)
"""

import os
import sys

DB_FILE = "sentinaliq.db"


def soft_reset():
    """Clear all scrap data but keep users"""
    print("[*] Connecting to database...")
    from models import init_db, SessionLocal, User
    from sqlalchemy import text
    
    init_db()
    db = SessionLocal()
    
    try:
        # Clear in reverse dependency order
        print("[1/6] Clearing monitor events...")
        db.execute(text("DELETE FROM monitor_events"))
        
        print("[2/6] Clearing incidents...")
        db.execute(text("DELETE FROM incidents"))
        
        print("[3/6] Clearing ingestion records...")
        db.execute(text("DELETE FROM ingestion_records"))
        
        print("[4/6] Clearing threat intel...")
        db.execute(text("DELETE FROM threat_intel"))
        
        print("[5/6] Clearing log events...")
        db.execute(text("DELETE FROM log_events"))
        
        print("[6/6] Clearing website monitors...")
        db.execute(text("DELETE FROM website_monitors"))
        
        db.commit()
        
        # Count remaining users
        user_count = db.query(User).count()
        print(f"\n[✓] Done! Cleared all scrap data.")
        print(f"    Preserved {user_count} user account(s).")
        print("    Restart the server for changes to take effect.")
    except Exception as e:
        db.rollback()
        print(f"[✗] Error: {e}")
        sys.exit(1)
    finally:
        db.close()


def hard_reset():
    """Delete the database file entirely"""
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
        print(f"[✓] Deleted {DB_FILE}")
        print("    Restart the server to recreate a fresh database.")
    else:
        print(f"[!] Database file not found: {DB_FILE}")


if __name__ == "__main__":
    if "--hard" in sys.argv:
        print("=" * 50)
        print("  HARD RESET - Delete entire database")
        print("=" * 50)
        confirm = input("  This will delete ALL data including users. Continue? (y/N): ")
        if confirm.lower() == "y":
            hard_reset()
        else:
            print("  Cancelled.")
    else:
        print("=" * 50)
        print("  SentinalIQ - Data Reset")
        print("=" * 50)
        print("  This will clear all scrap data while keeping user accounts.")
        print()
        soft_reset()

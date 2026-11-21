#!/usr/bin/env python3
"""
Collaborative Word Processor - Python Backend
Features:
- SQLite persistent storage
- Role-Based Access Control (RBAC) enforcement
- Automated Version History with unified diffs
- Cloud synchronization & offline conflict resolution
- Document outline & metrics generation
"""

import sys
import os
import json
import sqlite3
import difflib
import time
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "documents.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                avatar TEXT,
                color TEXT NOT NULL,
                default_role TEXT NOT NULL DEFAULT 'editor'
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                version_counter INTEGER NOT NULL DEFAULT 1
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_permissions (
                doc_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL, -- 'admin', 'editor', 'commenter', 'viewer'
                PRIMARY KEY (doc_id, user_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS versions (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                snapshot_type TEXT NOT NULL, -- 'auto', 'milestone', 'restore'
                summary TEXT,
                diff_summary TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                user_color TEXT NOT NULL,
                selection_text TEXT,
                line_number INTEGER,
                text TEXT NOT NULL,
                resolved INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        """)

        # Seed initial users if table is empty
        cursor.execute("SELECT COUNT(*) as count FROM users")
        if cursor.fetchone()["count"] == 0:
            sample_users = [
                ("u1", "Sarah Connor", "sarah@nexus.corp", "SC", "#2563eb", "admin"),
                ("u2", "Alex Rivera", "alex.r@nexus.corp", "AR", "#10b981", "editor"),
                ("u3", "Maya Lin", "maya.l@nexus.corp", "ML", "#f59e0b", "commenter"),
                ("u4", "David Chen", "david.c@nexus.corp", "DC", "#8b5cf6", "viewer"),
            ]
            cursor.executemany(
                "INSERT INTO users (id, name, email, avatar, color, default_role) VALUES (?, ?, ?, ?, ?, ?)",
                sample_users
            )

            # Sample Document
            initial_content = """# Quarterly Engineering & Product Blueprint 2026

Welcome to the **Collaborative Word Processor** blueprint. This document demonstrates real-time synchronization, rich Markdown capabilities, role-based governance, and version snapshots.

---

## 1. System Objectives & Architecture

Our primary goal is to provide a seamless, low-latency editing environment for distributed teams with strict data consistency:

* **Real-time Synchronized Buffer**: Peer cursor awareness and low-latency delta broadcasting.
* **Offline-First Resilience**: Automatic queueing of offline mutations with intelligent cloud merge.
* **Granular Governance (RBAC)**: Distinct permissions for *Admins*, *Editors*, *Commenters*, and *Viewers*.
* **Automated Snapshotting**: Periodic micro-snapshots alongside tagged milestones with visual line diffs.

```python
# Automated diff calculation example in Python backend
import difflib

def calculate_changes(prev_text, new_text):
    diff = difflib.ndiff(prev_text.splitlines(), new_text.splitlines())
    return [line for line in diff if line.startswith(('+', '-'))]
```

---

## 2. Key Deliverables & Timetable

| Milestone | Target Horizon | Status | Assigned Lead |
| :--- | :--- | :--- | :--- |
| **P1 - RBAC Authorization** | Q1 Week 4 | `Completed` | Sarah Connor |
| **P2 - Diff & Version History** | Q1 Week 8 | `Verified` | Alex Rivera |
| **P3 - Offline Sync Queue** | Q2 Week 2 | `In Progress` | Maya Lin |
| **P4 - Live Presence & Cursors** | Q2 Week 6 | `Live` | David Chen |

### Action Checklist
- [x] Enable SQLite schema with transactional locking
- [x] Configure Python stdlib HTTP micro-service
- [x] Implement unified diff calculation engine
- [ ] Finalize end-to-end cloud sync reconciliation
- [ ] Complete role elevation modal

> *Note: Changes made in offline mode will automatically reconcile when connectivity is restored.*

---

## 3. Markdown Formatting Standards

You can freely use:
1. **Bold**, *italics*, and ~~strikethrough~~ inline formatting.
2. Tables with structured column alignment.
3. Syntax-highlighted code blocks for multiple programming languages.
4. Blockquotes and interactive checklists.
"""
            now = int(time.time() * 1000)
            doc_id = "doc-alpha-01"
            cursor.execute("""
                INSERT INTO documents (id, title, content, owner_id, created_at, updated_at, version_counter)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (doc_id, "Quarterly Engineering & Product Blueprint", initial_content, "u1", now - 3600000, now, 2))

            # Permissions: u1=admin, u2=editor, u3=commenter, u4=viewer
            cursor.executemany("""
                INSERT INTO document_permissions (doc_id, user_id, role)
                VALUES (?, ?, ?)
            """, [
                (doc_id, "u1", "admin"),
                (doc_id, "u2", "editor"),
                (doc_id, "u3", "commenter"),
                (doc_id, "u4", "viewer"),
            ])

            # Initial baseline version
            cursor.execute("""
                INSERT INTO versions (id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("ver-01", doc_id, 1, "Initial Draft", initial_content[:400] + "\n\nInitial draft of Q1 blueprint.", "u1", "Sarah Connor", now - 3600000, "milestone", "Initial project creation", json.dumps({"added": 12, "removed": 0})))

            # Version 2 with current content
            cursor.execute("""
                INSERT INTO versions (id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("ver-02", doc_id, 2, "Added Architecture & Roadmap Details", initial_content, "u2", "Alex Rivera", now, "auto", "Added code snippet and milestone table", json.dumps({"added": 34, "removed": 2})))

            # Sample comment
            cursor.execute("""
                INSERT INTO comments (id, doc_id, user_id, user_name, user_color, selection_text, line_number, text, resolved, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("com-01", doc_id, "u3", "Maya Lin", "#f59e0b", "P3 - Offline Sync Queue", 38, "Ensure IndexedDB or localStorage fallback is verified during offline testing.", 0, now - 600000))

        conn.commit()

def calculate_diff_details(old_text, new_text):
    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
    diff_records = []
    added_count = 0
    removed_count = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for line in old_lines[i1:i2]:
                diff_records.append({'type': 'equal', 'text': line})
        elif tag == 'insert':
            for line in new_lines[j1:j2]:
                diff_records.append({'type': 'add', 'text': line})
                added_count += 1
        elif tag == 'delete':
            for line in old_lines[i1:i2]:
                diff_records.append({'type': 'remove', 'text': line})
                removed_count += 1
        elif tag == 'replace':
            for line in old_lines[i1:i2]:
                diff_records.append({'type': 'remove', 'text': line})
                removed_count += 1
            for line in new_lines[j1:j2]:
                diff_records.append({'type': 'add', 'text': line})
                added_count += 1

    return {
        "diff": diff_records,
        "summary": {"added": added_count, "removed": removed_count}
    }

def compute_document_stats(content):
    lines = content.splitlines()
    words = content.split()
    word_count = len(words)
    char_count = len(content)
    reading_time_min = max(1, round(word_count / 200, 1))

    outline = []
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('#'):
            level = 0
            while level < len(stripped) and stripped[level] == '#':
                level += 1
            if level <= 6 and len(stripped) > level and stripped[level] == ' ':
                title = stripped[level:].strip()
                outline.append({
                    "line": idx + 1,
                    "level": level,
                    "title": title,
                    "id": title.lower().replace(' ', '-').replace('&', '').replace('/', '')
                })

    return {
        "words": word_count,
        "characters": char_count,
        "lines": len(lines),
        "readingTimeMinutes": reading_time_min,
        "headings": len(outline),
        "outline": outline
    }

class RequestHandler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id')
        self.end_headers()

    def get_current_user_id(self):
        return self.headers.get('X-User-Id', 'u1')

    def check_permission(self, doc_id, user_id, required_roles):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT dp.role, d.owner_id
                FROM documents d
                LEFT JOIN document_permissions dp ON dp.doc_id = d.id AND dp.user_id = ?
                WHERE d.id = ?
            """, (user_id, doc_id))
            row = cursor.fetchone()
            if not row:
                return None, "Document not found"

            # Owner is always admin
            role = row["role"]
            if row["owner_id"] == user_id:
                role = "admin"
            elif not role:
                # Default fallback role
                cursor.execute("SELECT default_role FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                role = user_row["default_role"] if user_row else "viewer"

            if role in required_roles:
                return role, None
            return role, f"Permission denied: role '{role}' is not in allowed roles {required_roles}"

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        user_id = self.get_current_user_id()

        if path == "/api/health":
            self.send_json({"status": "ok", "python": sys.version, "engine": "Python 3 SQLite"})
            return

        elif path == "/api/users":
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, email, avatar, color, default_role FROM users")
                users = [dict(r) for r in cursor.fetchall()]
                self.send_json({"users": users})
            return

        elif path == "/api/documents":
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at, d.version_counter,
                           u.name as owner_name,
                           COALESCE(dp.role, CASE WHEN d.owner_id = ? THEN 'admin' ELSE 'viewer' END) as user_role,
                           (SELECT COUNT(*) FROM versions WHERE doc_id = d.id) as version_count
                    FROM documents d
                    LEFT JOIN users u ON u.id = d.owner_id
                    LEFT JOIN document_permissions dp ON dp.doc_id = d.id AND dp.user_id = ?
                    ORDER BY d.updated_at DESC
                """, (user_id, user_id))
                docs = [dict(r) for r in cursor.fetchall()]
                self.send_json({"documents": docs})
            return

        elif path.startswith("/api/documents/") and "/versions" in path:
            # /api/documents/:id/versions
            parts = path.split("/")
            doc_id = parts[3]
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary
                    FROM versions
                    WHERE doc_id = ?
                    ORDER BY version_number DESC
                """, (doc_id,))
                versions = []
                for row in cursor.fetchall():
                    item = dict(row)
                    if item.get("diff_summary"):
                        try:
                            item["diff_summary"] = json.loads(item["diff_summary"])
                        except Exception:
                            pass
                    versions.append(item)
                self.send_json({"versions": versions})
            return

        elif path.startswith("/api/documents/") and "/comments" in path:
            parts = path.split("/")
            doc_id = parts[3]
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, doc_id, user_id, user_name, user_color, selection_text, line_number, text, resolved, created_at
                    FROM comments
                    WHERE doc_id = ?
                    ORDER BY created_at ASC
                """, (doc_id,))
                comments = [dict(r) for r in cursor.fetchall()]
                self.send_json({"comments": comments})
            return

        elif path.startswith("/api/documents/") and "/permissions" in path:
            parts = path.split("/")
            doc_id = parts[3]
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT u.id, u.name, u.email, u.avatar, u.color,
                           COALESCE(dp.role, CASE WHEN d.owner_id = u.id THEN 'admin' ELSE 'viewer' END) as role,
                           (d.owner_id = u.id) as is_owner
                    FROM users u
                    CROSS JOIN documents d ON d.id = ?
                    LEFT JOIN document_permissions dp ON dp.doc_id = d.id AND dp.user_id = u.id
                """, (doc_id,))
                perms = [dict(r) for r in cursor.fetchall()]
                self.send_json({"permissions": perms})
            return

        elif path.startswith("/api/documents/"):
            parts = path.split("/")
            doc_id = parts[3]
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at, d.version_counter,
                           u.name as owner_name
                    FROM documents d
                    LEFT JOIN users u ON u.id = d.owner_id
                    WHERE d.id = ?
                """, (doc_id,))
                row = cursor.fetchone()
                if not row:
                    self.send_json({"error": "Document not found"}, status=404)
                    return

                doc = dict(row)
                role, _ = self.check_permission(doc_id, user_id, ["admin", "editor", "commenter", "viewer"])
                doc["currentUserRole"] = role
                doc["stats"] = compute_document_stats(doc["content"])
                self.send_json({"document": doc})
            return

        self.send_json({"error": "Not Found"}, status=404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        user_id = self.get_current_user_id()
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}

        if path == "/api/documents":
            title = body.get("title", "Untitled Document").strip() or "Untitled Document"
            content = body.get("content", "# Untitled Document\n\nStart typing your content here...\n")
            doc_id = f"doc-{int(time.time()*1000)}"
            now = int(time.time() * 1000)

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO documents (id, title, content, owner_id, created_at, updated_at, version_counter)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                """, (doc_id, title, content, user_id, now, now))

                cursor.execute("""
                    INSERT INTO document_permissions (doc_id, user_id, role)
                    VALUES (?, ?, 'admin')
                """, (doc_id, user_id))

                cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                author_name = user_row["name"] if user_row else "Current User"

                cursor.execute("""
                    INSERT INTO versions (id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary)
                    VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'milestone', 'Document Created', ?)
                """, (f"ver-{now}", doc_id, title, content, user_id, author_name, now, json.dumps({"added": len(content.splitlines()), "removed": 0})))

                conn.commit()

            self.send_json({"document": {"id": doc_id, "title": title, "content": content, "owner_id": user_id, "updated_at": now}}, status=201)
            return

        elif path == "/api/sync":
            # Cloud synchronization batch endpoint
            doc_id = body.get("doc_id")
            client_content = body.get("content")
            client_title = body.get("title")
            client_timestamp = body.get("client_timestamp", int(time.time() * 1000))
            base_version = body.get("base_version")

            if not doc_id:
                self.send_json({"error": "Missing doc_id"}, status=400)
                return

            role, err = self.check_permission(doc_id, user_id, ["admin", "editor"])
            if err:
                self.send_json({"error": err, "permissionDenied": True}, status=403)
                return

            now = int(time.time() * 1000)
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, title, content, updated_at, version_counter FROM documents WHERE id = ?", (doc_id,))
                doc = cursor.fetchone()
                if not doc:
                    self.send_json({"error": "Document not found"}, status=404)
                    return

                server_content = doc["content"]
                server_counter = doc["version_counter"]
                server_updated_at = doc["updated_at"]

                # Conflict detection
                is_conflict = False
                diff_data = None
                if base_version is not None and base_version < server_counter and server_content != client_content:
                    is_conflict = True
                    diff_data = calculate_diff_details(server_content, client_content)

                new_counter = server_counter + 1
                cursor.execute("""
                    UPDATE documents
                    SET content = ?, title = COALESCE(?, title), updated_at = ?, version_counter = ?
                    WHERE id = ?
                """, (client_content, client_title, now, new_counter, doc_id))

                # Create sync version checkpoint
                cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                author_name = user_row["name"] if user_row else "Collaborator"

                diff_summary = calculate_diff_details(server_content, client_content)["summary"]
                ver_id = f"ver-{now}"
                cursor.execute("""
                    INSERT INTO versions (id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'auto', 'Cloud Sync Checkpoint', ?)
                """, (ver_id, doc_id, new_counter, client_title or doc["title"], client_content, user_id, author_name, now, json.dumps(diff_summary)))

                conn.commit()

            self.send_json({
                "success": True,
                "synced_at": now,
                "new_version": new_counter,
                "conflict_resolved": is_conflict,
                "diff": diff_data
            })
            return

        elif path.startswith("/api/documents/") and "/versions" in path:
            # Manual snapshot or milestone
            parts = path.split("/")
            doc_id = parts[3]
            role, err = self.check_permission(doc_id, user_id, ["admin", "editor"])
            if err:
                self.send_json({"error": err}, status=403)
                return

            title = body.get("title", "Milestone Snapshot").strip()
            summary = body.get("summary", "Manual snapshot created by user")
            snapshot_type = body.get("type", "milestone")

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT content, version_counter FROM documents WHERE id = ?", (doc_id,))
                doc = cursor.fetchone()
                if not doc:
                    self.send_json({"error": "Document not found"}, status=404)
                    return

                new_version = doc["version_counter"] + 1
                cursor.execute("UPDATE documents SET version_counter = ? WHERE id = ?", (new_version, doc_id))

                cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                author_name = user_row["name"] if user_row else "User"

                # Previous version for diff
                cursor.execute("SELECT content FROM versions WHERE doc_id = ? ORDER BY version_number DESC LIMIT 1", (doc_id,))
                last_ver = cursor.fetchone()
                prev_content = last_ver["content"] if last_ver else ""
                diff_summary = calculate_diff_details(prev_content, doc["content"])["summary"]

                ver_id = f"ver-{int(time.time()*1000)}"
                now = int(time.time() * 1000)
                cursor.execute("""
                    INSERT INTO versions (id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (ver_id, doc_id, new_version, title, doc["content"], user_id, author_name, now, snapshot_type, summary, json.dumps(diff_summary)))

                conn.commit()

            self.send_json({"version": {
                "id": ver_id,
                "version_number": new_version,
                "title": title,
                "author_name": author_name,
                "created_at": now,
                "snapshot_type": snapshot_type,
                "summary": summary,
                "diff_summary": diff_summary
            }}, status=201)
            return

        elif path.startswith("/api/documents/") and "/restore" in path:
            # Restore version
            parts = path.split("/")
            doc_id = parts[3]
            ver_id = body.get("version_id")
            role, err = self.check_permission(doc_id, user_id, ["admin"])
            if err:
                self.send_json({"error": "Only Administrators and Owners can restore document versions"}, status=403)
                return

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT content, title, version_number FROM versions WHERE id = ? AND doc_id = ?", (ver_id, doc_id))
                ver = cursor.fetchone()
                if not ver:
                    self.send_json({"error": "Version not found"}, status=404)
                    return

                cursor.execute("SELECT version_counter, content FROM documents WHERE id = ?", (doc_id,))
                doc = cursor.fetchone()
                new_version = doc["version_counter"] + 1
                now = int(time.time() * 1000)

                cursor.execute("""
                    UPDATE documents
                    SET content = ?, updated_at = ?, version_counter = ?
                    WHERE id = ?
                """, (ver["content"], now, new_version, doc_id))

                cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                author_name = user_row["name"] if user_row else "Admin"

                diff_summary = calculate_diff_details(doc["content"], ver["content"])["summary"]
                restore_ver_id = f"ver-{now}"
                cursor.execute("""
                    INSERT INTO versions (id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'restore', ?, ?)
                """, (restore_ver_id, doc_id, new_version, f"Restored from v{ver['version_number']}", ver["content"], user_id, author_name, now, f"Reverted back to snapshot: {ver['title']}", json.dumps(diff_summary)))

                conn.commit()

            self.send_json({"success": True, "restored_content": ver["content"], "new_version": new_version})
            return

        elif path.startswith("/api/documents/") and "/comments" in path:
            parts = path.split("/")
            doc_id = parts[3]
            role, err = self.check_permission(doc_id, user_id, ["admin", "editor", "commenter"])
            if err:
                self.send_json({"error": "Viewers cannot post comments"}, status=403)
                return

            text = body.get("text", "").strip()
            if not text:
                self.send_json({"error": "Comment text cannot be empty"}, status=400)
                return

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name, color FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                user_name = user_row["name"] if user_row else "Commenter"
                user_color = user_row["color"] if user_row else "#3b82f6"

                comment_id = f"com-{int(time.time()*1000)}"
                now = int(time.time() * 1000)
                cursor.execute("""
                    INSERT INTO comments (id, doc_id, user_id, user_name, user_color, selection_text, line_number, text, resolved, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                """, (comment_id, doc_id, user_id, user_name, user_color, body.get("selection_text"), body.get("line_number"), text, now))
                conn.commit()

            self.send_json({
                "comment": {
                    "id": comment_id,
                    "doc_id": doc_id,
                    "user_id": user_id,
                    "user_name": user_name,
                    "user_color": user_color,
                    "selection_text": body.get("selection_text"),
                    "line_number": body.get("line_number"),
                    "text": text,
                    "resolved": 0,
                    "created_at": now
                }
            }, status=201)
            return

        elif path.startswith("/api/documents/") and "/permissions" in path:
            # RBAC Role assignment (Admin only)
            parts = path.split("/")
            doc_id = parts[3]
            role, err = self.check_permission(doc_id, user_id, ["admin"])
            if err:
                self.send_json({"error": "Only Administrators can modify user roles"}, status=403)
                return

            target_user_id = body.get("user_id")
            new_role = body.get("role")
            if new_role not in ["admin", "editor", "commenter", "viewer"]:
                self.send_json({"error": "Invalid role specified"}, status=400)
                return

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO document_permissions (doc_id, user_id, role)
                    VALUES (?, ?, ?)
                    ON CONFLICT(doc_id, user_id) DO UPDATE SET role = excluded.role
                """, (doc_id, target_user_id, new_role))
                conn.commit()

            self.send_json({"success": True, "user_id": target_user_id, "role": new_role})
            return

        elif path == "/api/markdown/diff":
            # Compare any two arbitrary texts
            text_a = body.get("text_a", "")
            text_b = body.get("text_b", "")
            diff_result = calculate_diff_details(text_a, text_b)
            self.send_json(diff_result)
            return

        elif path == "/api/markdown/stats":
            content = body.get("content", "")
            stats = compute_document_stats(content)
            self.send_json(stats)
            return

        self.send_json({"error": "Not Found"}, status=404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        user_id = self.get_current_user_id()
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}

        if path.startswith("/api/documents/"):
            parts = path.split("/")
            doc_id = parts[3]
            role, err = self.check_permission(doc_id, user_id, ["admin", "editor"])
            if err:
                self.send_json({"error": err, "role": role}, status=403)
                return

            new_content = body.get("content")
            new_title = body.get("title")
            create_auto_version = body.get("create_auto_version", False)
            now = int(time.time() * 1000)

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT content, title, version_counter FROM documents WHERE id = ?", (doc_id,))
                doc = cursor.fetchone()
                if not doc:
                    self.send_json({"error": "Document not found"}, status=404)
                    return

                old_content = doc["content"]
                new_version_counter = doc["version_counter"]

                if create_auto_version and new_content != old_content:
                    new_version_counter += 1
                    cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
                    u_row = cursor.fetchone()
                    author_name = u_row["name"] if u_row else "Collaborator"

                    diff_summary = calculate_diff_details(old_content, new_content)["summary"]
                    ver_id = f"ver-{now}"
                    cursor.execute("""
                        INSERT INTO versions (id, doc_id, version_number, title, content, author_id, author_name, created_at, snapshot_type, summary, diff_summary)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'auto', 'Periodic auto-save checkpoint', ?)
                    """, (ver_id, doc_id, new_version_counter, new_title or doc["title"], new_content, user_id, author_name, now, json.dumps(diff_summary)))

                cursor.execute("""
                    UPDATE documents
                    SET content = COALESCE(?, content),
                        title = COALESCE(?, title),
                        updated_at = ?,
                        version_counter = ?
                    WHERE id = ?
                """, (new_content, new_title, now, new_version_counter, doc_id))
                conn.commit()

            self.send_json({"success": True, "updated_at": now, "version_counter": new_version_counter})
            return

        self.send_json({"error": "Not Found"}, status=404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        user_id = self.get_current_user_id()

        if path.startswith("/api/documents/"):
            parts = path.split("/")
            doc_id = parts[3]
            role, err = self.check_permission(doc_id, user_id, ["admin"])
            if err:
                self.send_json({"error": "Only Administrators or the Document Owner can delete this document"}, status=403)
                return

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
                cursor.execute("DELETE FROM document_permissions WHERE doc_id = ?", (doc_id,))
                cursor.execute("DELETE FROM versions WHERE doc_id = ?", (doc_id,))
                cursor.execute("DELETE FROM comments WHERE doc_id = ?", (doc_id,))
                conn.commit()

            self.send_json({"success": True, "deleted_id": doc_id})
            return

        self.send_json({"error": "Not Found"}, status=404)

    def log_message(self, format, *args):
        # Suppress verbose standard HTTP request logging in stdout
        pass

def run_server():
    init_db()
    server_address = ('127.0.0.1', PORT)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"[Python Backend] Serving on http://127.0.0.1:{PORT} with SQLite at {DB_PATH}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run_server()

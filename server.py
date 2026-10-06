#!/usr/bin/env python3
"""ScoreBox - 악보 이미지/PDF 정리 플랫폼 (표준 라이브러리만 사용, 로컬 전용)."""
import csv
import io
import json
import mimetypes
import os
import re
import sys
import threading
import urllib.parse
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get("SCOREBOX_CONFIG", ROOT / "config.json"))
EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".pdf"}
KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
DEFAULT_TEMPOS = [
    {"id": "fast", "label": "빠른", "keywords": ["빠른", "fast", "경쾌", "신나는"]},
    {"id": "mid", "label": "보통", "keywords": []},
    {"id": "slow", "label": "느린", "keywords": ["느린", "slow", "잔잔", "고요", "묵상"]},
]
LOCK = threading.Lock()

# 파일명에서 코드/빠르기 추정
KEY_RE = re.compile(r"(?:^|[\s_\-()\[\].,])([A-G](?:#|b)?m?)(?=$|[\s_\-()\[\].,])")


def load_config():
    cfg = {"scores_dir": "./scores", "data_file": "./scorebox_data.json",
           "host": "127.0.0.1", "port": 8765}
    if CONFIG_PATH.exists():
        cfg.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
    else:
        CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    for k in ("scores_dir", "data_file"):
        p = Path(os.path.expandvars(os.path.expanduser(cfg[k])))
        cfg[k] = (p if p.is_absolute() else ROOT / p).resolve()
    return cfg


CFG = load_config()
SCORES_DIR: Path = CFG["scores_dir"]
DATA_FILE: Path = CFG["data_file"]


def load_db():
    db = json.loads(DATA_FILE.read_text(encoding="utf-8")) if DATA_FILE.exists() else {"scores": {}}
    db.setdefault("tempos", [dict(t) for t in DEFAULT_TEMPOS])
    return db


def save_db(db):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, DATA_FILE)  # 원자적 교체 (OneDrive 동기화 중 깨짐 방지)


def guess(stem, tempos):
    key = ""
    for m in KEY_RE.finditer(stem):
        key = m.group(1)
        break
    low = stem.lower()
    tempo = ""
    title = KEY_RE.sub(" ", stem)
    for t in tempos:
        for w in t.get("keywords", []):
            if w and w.lower() in low:
                tempo = tempo or t["id"]
                title = re.sub(re.escape(w), " ", title, flags=re.I)
    title = re.sub(r"[_\-]+", " ", title)
    title = re.sub(r"\s+", " ", title).strip() or stem
    return title, key, tempo


def scan():
    """scores_dir 를 훑어 새 파일은 추가, 사라진 파일은 missing 표시."""
    db = load_db()
    scores = db["scores"]
    found = set()
    if SCORES_DIR.exists():
        for p in sorted(SCORES_DIR.rglob("*")):
            if p.is_file() and p.suffix.lower() in EXTS:
                rel = p.relative_to(SCORES_DIR).as_posix()
                found.add(rel)
                if rel not in scores:
                    title, key, tempo = guess(p.stem, db["tempos"])
                    folder = p.parent.relative_to(SCORES_DIR).as_posix()
                    tags = [] if folder == "." else [t for t in folder.split("/") if t]
                    scores[rel] = {"title": title, "key": key, "tempo": tempo, "tags": tags,
                                   "note": "", "reviewed": False, "missing": False}
                else:
                    scores[rel]["missing"] = False
    for rel, s in scores.items():
        if rel not in found:
            s["missing"] = True
    save_db(db)
    return {"total": len(found), "missing": sum(1 for s in scores.values() if s["missing"])}


def clean_patch(patch, tempos):
    out = {}
    if "title" in patch:
        out["title"] = str(patch["title"]).strip()
    if "key" in patch:
        out["key"] = str(patch["key"]).strip()
    if "tempo" in patch and patch["tempo"] in ("", *(t["id"] for t in tempos)):
        out["tempo"] = patch["tempo"]
    if "tags" in patch:
        out["tags"] = sorted({str(t).strip() for t in patch["tags"] if str(t).strip()})
    if "note" in patch:
        out["note"] = str(patch["note"])
    if "reviewed" in patch:
        out["reviewed"] = bool(patch["reviewed"])
    return out


def update(ids, patch, add_tags=(), remove_tags=()):
    with LOCK:
        db = load_db()
        patch = clean_patch(patch, db["tempos"])
        for i in ids:
            s = db["scores"].get(i)
            if not s:
                continue
            s.update(patch)
            if add_tags or remove_tags:
                tags = (set(s["tags"]) | {t.strip() for t in add_tags if t.strip()}) - set(remove_tags)
                s["tags"] = sorted(tags)
        save_db(db)


def set_tempos(items):
    """분류 목록 저장. 새 항목은 id 부여, 삭제된 분류를 쓰던 곡은 분류 해제."""
    tempos, seen = [], set()
    for t in items:
        label = str(t.get("label", "")).strip()
        if not label:
            continue
        tid = str(t.get("id") or "") or "c" + uuid.uuid4().hex[:6]
        if tid in seen:
            continue
        seen.add(tid)
        kws = [k.strip() for k in t.get("keywords", []) if str(k).strip()]
        tempos.append({"id": tid, "label": label, "keywords": kws})
    with LOCK:
        db = load_db()
        db["tempos"] = tempos
        for sc in db["scores"].values():
            if sc["tempo"] not in seen:
                sc["tempo"] = ""
        save_db(db)


def export_csv():
    db = load_db()
    labels = {t["id"]: t["label"] for t in db["tempos"]}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["파일", "제목", "코드", "빠르기", "주제", "메모"])
    for rel, s in sorted(db["scores"].items()):
        w.writerow([rel, s["title"], s["key"], labels.get(s["tempo"], ""), ",".join(s["tags"]), s["note"]])
    return ("﻿" + buf.getvalue()).encode("utf-8")  # 엑셀 한글 호환(BOM)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        if path in ("/", "/index.html"):
            return self._send(200, (ROOT / "static" / "index.html").read_bytes(), "text/html; charset=utf-8")
        if path == "/api/scores":
            db = load_db()
            items = [{"id": k, **v} for k, v in db["scores"].items()]
            return self._send(200, {"items": items, "keys": KEYS, "tempos": db["tempos"],
                                    "scores_dir": str(SCORES_DIR)})
        if path == "/api/export.csv":
            return self._send(200, export_csv(), "text/csv; charset=utf-8",
                              {"Content-Disposition": 'attachment; filename="scorebox.csv"'})
        if path.startswith("/files/"):
            target = (SCORES_DIR / path[len("/files/"):]).resolve()
            if SCORES_DIR not in target.parents or not target.is_file():
                return self._send(404, {"error": "not found"})
            ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            return self._send(200, target.read_bytes(), ctype, {"Cache-Control": "max-age=3600"})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            data = self._body()
            if path == "/api/scan":
                with LOCK:
                    return self._send(200, scan())
            if path == "/api/tempos":
                set_tempos(data.get("tempos", []))
                return self._send(200, {"ok": True})
            if path == "/api/update":
                update(data.get("ids", []), data.get("patch", {}),
                       data.get("add_tags", []), data.get("remove_tags", []))
                return self._send(200, {"ok": True})
        except Exception as e:  # noqa: BLE001
            return self._send(500, {"error": str(e)})
        self._send(404, {"error": "not found"})


def main():
    SCORES_DIR.mkdir(parents=True, exist_ok=True)
    host, port = CFG["host"], int(CFG["port"])
    url = f"http://{host}:{port}/"
    print(f"악보 폴더 : {SCORES_DIR}\n데이터 파일: {DATA_FILE}\n주소      : {url}\n(종료: Ctrl+C)")
    with LOCK:
        scan()
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()

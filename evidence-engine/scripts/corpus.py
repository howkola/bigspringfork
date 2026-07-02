#!/usr/bin/env python3
"""Local, network-free helpers for the Project Harmony evidence corpus.

Retrieval/verification is done by Claude through the MCP connectors (Exa,
Consensus, Instrumentl) as described in the skill. This module only reads,
filters, reports on, and assembles the corpus that lives on disk — no network,
stdlib only — so it stays inspectable and version-controlled.

Usage:
    python3 corpus.py list      corpus/matys.json --program Anti-Trafficking
    python3 corpus.py stale     corpus/matys.json --today 2026-07-02
    python3 corpus.py assemble  corpus/matys.json --program Anti-Trafficking --lens Federal
    python3 corpus.py report    corpus/matys.json
"""
import argparse
import datetime as dt
import json
import sys

STALE_STATUSES = {"VERIFY", "PULL"}


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def claims_of(doc):
    return doc.get("claims", [])


def match(claim, program=None, geo=None, lens=None, status=None):
    if program and program not in claim.get("programs", []):
        return False
    if lens and lens not in claim.get("lenses", []):
        return False
    if geo and claim.get("geo") != geo:
        return False
    if status and claim.get("status") != status:
        return False
    return True


def cmd_list(doc, args):
    for c in claims_of(doc):
        if match(c, args.program, args.geo, args.lens, args.status):
            print(f"[{c['id']}] ({c['status']}) {c['claim']}")


def cmd_stale(doc, args):
    """Claims needing (re)verification: unverified statuses, or verified figures
    whose last_verified is older than the freshness window."""
    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()
    window = dt.timedelta(days=args.max_age_days)
    flagged = []
    for c in claims_of(doc):
        reason = None
        if c.get("status") in STALE_STATUSES:
            reason = f"status={c['status']} (never web-verified)"
        elif c.get("last_verified"):
            age = today - dt.date.fromisoformat(c["last_verified"])
            if age > window:
                reason = f"last verified {age.days}d ago (> {args.max_age_days}d)"
        else:
            reason = "no last_verified stamp"
        if reason:
            flagged.append((c["id"], reason))
    if not flagged:
        print("All claims fresh.")
    for cid, reason in flagged:
        print(f"[{cid}] REVALIDATE — {reason}")


def cmd_assemble(doc, args):
    """Emit a cited need-statement skeleton for a (program x lens x geo) slice,
    with inline [id] markers, a source appendix, and the Honest Draft report."""
    selected = [c for c in claims_of(doc)
                if match(c, args.program, args.geo, args.lens)]
    if not selected:
        print("No claims match that slice.")
        return
    print("=== CITED NEED STATEMENT (draft skeleton) ===\n")
    for c in selected:
        print(f"{c['claim']} [{c['id']}]\n")
    print("=== SOURCE APPENDIX ===")
    for c in selected:
        url = c.get("source_url") or "(source_url not yet resolved)"
        print(f"[{c['id']}] {c['source']} — {url}")
    print()
    _print_report(selected)


def cmd_report(doc, args):
    _print_report(claims_of(doc))


def _print_report(claims):
    print("=== HONEST DRAFT INTEGRITY REPORT ===")
    by_status = {}
    for c in claims:
        by_status.setdefault(c.get("status", "?"), []).append(c["id"])
    for status in ("VERIFIED-WEB", "VERIFY", "PULL", "INTERNAL"):
        ids = by_status.get(status, [])
        if ids:
            print(f"  {status}: {', '.join(ids)}")
    flags = [(c["id"], f) for c in claims for f in c.get("red_team_flags", [])]
    if flags:
        print("  RED-TEAM FLAGS:")
        for cid, f in flags:
            print(f"    [{cid}] {f}")
    needs_review = [c["id"] for c in claims if c.get("status") in STALE_STATUSES]
    if needs_review:
        print(f"  HUMAN REVIEW REQUIRED BEFORE SUBMISSION: {', '.join(needs_review)}")
    else:
        print("  All selected claims web-verified.")


COMMANDS = {
    "list": cmd_list,
    "stale": cmd_stale,
    "assemble": cmd_assemble,
    "report": cmd_report,
}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("command", choices=COMMANDS)
    p.add_argument("path")
    p.add_argument("--program")
    p.add_argument("--geo")
    p.add_argument("--lens")
    p.add_argument("--status")
    p.add_argument("--today")
    p.add_argument("--max-age-days", type=int, default=180,
                   help="Freshness window for web-verified claims (default 180).")
    args = p.parse_args(argv)
    doc = load(args.path)
    COMMANDS[args.command](doc, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())

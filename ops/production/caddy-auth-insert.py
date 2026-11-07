#!/usr/bin/env python3
"""Narrow Caddy route insertion. Runs ONLY during reviewed auth go-live.

No rewriting of an unknown site block or existing auth route.
"""
import re
from pathlib import Path

ROUTES = """
    # Career.Agency auth API, exact paths; preserve existing public landing/feed.
    handle /api/auth/* {
        reverse_proxy 127.0.0.1:8765
    }
    handle /api/admin/* {
        reverse_proxy 127.0.0.1:8765
    }
    handle /account/* {
        reverse_proxy 127.0.0.1:8765
    }
    # Inert historical Supabase pilot must not become a second login entry.
    handle /account.html {
        redir /account/login 308
    }
    handle /admin {
        reverse_proxy 127.0.0.1:8765
    }
    handle /app/* {
        reverse_proxy 127.0.0.1:8765
    }
    handle /app {
        redir /app/ 308
    }
"""

SITE = re.compile(
    r"(?m)^[ \t]*(?:(?:https?://)?(?:www\.)?careeragency\.ch)"
    r"(?:\s*,\s*(?:(?:https?://)?(?:www\.)?careeragency\.ch))*"
    r"\s*\{"
)

def brace_pairs(data: str):
    """Balance braces while respecting comments and quoted Caddy string literals."""
    depth=0
    stack=[]
    pairs={}
    quote=None
    escaped=False
    comment=False
    for i,ch in enumerate(data):
        if comment:
            if ch=="\n": comment=False
            continue
        if quote:
            if escaped: escaped=False
            elif ch=="\\": escaped=True
            elif ch==quote: quote=None
            continue
        if ch=="#": comment=True
        elif ch in ('"',"'","\x60"): quote=ch
        elif ch=="{":
            stack.append(i);depth+=1
        elif ch=="}":
            if not stack: raise ValueError("Unbalanced Caddyfile")
            start=stack.pop();depth-=1
            pairs[start]=i
    if stack or quote:
        raise ValueError("Unbalanced or unterminated Caddyfile")
    return pairs

def insert_routes(data: str) -> str:
    matches=list(SITE.finditer(data))
    if len(matches)!=1:
        raise ValueError("Expected exactly one explicit careeragency.ch site block")
    pair=brace_pairs(data)
    opener=matches[0].end()-1
    if opener not in pair:
        raise ValueError("Site block not structurally valid")
    # Only add to a top-level site block, not nested route definitions.
    before=data[:opener]
    if before.count("{")!=before.count("}"):
        raise ValueError("Site block is not at top level")
    start,end=opener,pair[opener]
    block=data[start:end]
    if re.search(r"(?:^|[{}\n])\s*(?:import|route|rewrite)\b",block):
        # Those existing directives can reorder/expose protected routes.
        raise ValueError("Existing Caddy routing requires manual compatibility review")
    if any(x in data for x in ("/api/auth/", "/api/admin/", "/account/", "/app/")):
        raise ValueError("Existing auth routes; refuse duplicate or conflicting installation")
    return data[:start+1] + "\n" + ROUTES + data[start+1:]

if __name__ == "__main__":
    import argparse
    ap=argparse.ArgumentParser()
    ap.add_argument("source",type=Path)
    ap.add_argument("output",type=Path)
    args=ap.parse_args()
    args.output.write_text(insert_routes(args.source.read_text(encoding="utf-8")),encoding="utf-8")

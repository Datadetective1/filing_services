#!/usr/bin/env python3
"""Register Filewell's alert address with Registered Agents Inc (Corporate Tools API).

Run it once from your own computer:

    python3 rai_register_callback.py

It asks for your RAI Access Key and Secret Key (typing is hidden), checks which
callbacks are already registered, adds Filewell's address if it is missing, and
lists the callbacks again so you can see it there. Nothing is saved or printed
except the callback list. Only Python 3 is needed; there is nothing to install.

How requests are signed comes from RAI's public examples
(github.com/corptools-api/CorpTools-API-Examples, python/request.py):
a JWT, HS256 with the Secret Key, header carries access_key, claims are the
request path and the SHA-256 of the request body, sent as a Bearer token.
"""

import base64
import getpass
import hashlib
import hmac
import json
import sys
import urllib.error
import urllib.request

API_URL = "https://api.corporatetools.com"
CALLBACK_URL = "https://www.getfilewell.com/api/webhooks/registered-agent"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def make_token(access_key: str, secret_key: str, path: str, body: str) -> str:
    header = {"alg": "HS256", "typ": "JWT", "access_key": access_key}
    claims = {"path": path, "content": hashlib.sha256(body.encode("utf-8")).hexdigest()}
    signing_input = b64url(json.dumps(header, separators=(",", ":")).encode()) + "." + b64url(
        json.dumps(claims, separators=(",", ":")).encode()
    )
    sig = hmac.new(secret_key.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return signing_input + "." + b64url(sig)


def call(method: str, path: str, access_key: str, secret_key: str, body_obj=None):
    body = json.dumps(body_obj) if body_obj is not None else ""
    req = urllib.request.Request(
        API_URL + path,
        data=body.encode("utf-8") if body else None,
        method=method,
        headers={
            "Authorization": "Bearer " + make_token(access_key, secret_key, path, body),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Filewell-callback-setup/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", "replace")[:500]
        try:
            return e.code, json.loads(text)
        except ValueError:
            return e.code, {"raw": text}


def show(callbacks):
    if not callbacks:
        print("  (none)")
    for cb in callbacks:
        print("  -", cb.get("url"), "| id", cb.get("id"), "| created", cb.get("created_at"))


def main() -> int:
    print("Filewell: register the alert address with Registered Agents Inc.\n")
    access_key = getpass.getpass("RAI Access Key (hidden): ").strip()
    secret_key = getpass.getpass("RAI Secret Key (hidden): ").strip()
    if not access_key or not secret_key:
        print("Both keys are needed. Nothing was changed.")
        return 1

    status, data = call("GET", "/callbacks", access_key, secret_key)
    if status != 200 or not data.get("success", False):
        print(f"\nRAI refused the request (HTTP {status}). Nothing was changed.")
        print("Their answer:", json.dumps(data)[:500])
        if status in (401, 403):
            print("\nCheck the two keys, and in the RAI portal open API Management > Permitted IPs:")
            print("if any IPs are listed there, add this computer's IP and run this again.")
        return 1

    existing = data.get("result") or []
    print("\nCallbacks registered now:")
    show(existing)

    if any((cb.get("url") or "").rstrip("/") == CALLBACK_URL for cb in existing):
        print("\nFilewell's address is already registered. Nothing to do.")
        return 0

    status, data = call("POST", "/callbacks", access_key, secret_key, {"url": CALLBACK_URL})
    if status not in (200, 201) or not data.get("success", False):
        print(f"\nAdding the callback failed (HTTP {status}).")
        print("Their answer:", json.dumps(data)[:500])
        return 1
    print("\nAdded:", (data.get("result") or {}).get("url"))

    status, data = call("GET", "/callbacks", access_key, secret_key)
    print("\nCallbacks registered now:")
    show(data.get("result") or [])
    ok = any((cb.get("url") or "").rstrip("/") == CALLBACK_URL for cb in (data.get("result") or []))
    print("\nDone. Filewell's address is registered." if ok else "\nRAI said it was added but it isn't listed yet.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

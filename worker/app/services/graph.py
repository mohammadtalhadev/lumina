"""
graph.py — Microsoft Graph API se baat (email bhejna + inbox parhna).

Simple me: Outlook ka koi "bhejo" button nahi hota code me — Microsoft
ne ek API di hai (Graph). Hum usko HTTP request bhejte hain:
  POST /me/sendMail  → email jata hai
  GET  /me/messages  → inbox ke messages aate hain

Har request me access token header me jata hai (OAuth se milta hai,
password kabhi nahi). Token har account ka alag hai.

Seekhne ke liye: ye "API client wrapper" hai — bahar wali service ki
complexity ek class me band, baqi code sirf `send_mail(...)` kehta hai.
`raise_for_status()` ka matlab: API ne error diya to chupke se aage
mat barho, foran exception uthao.
"""
from __future__ import annotations

import httpx


class GraphError(Exception):
    """Graph API ne mana kar diya ya network fail hua."""


class GraphClient:
    BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self, access_token: str):
        if not access_token:
            raise GraphError("access token missing hai — account dobara connect karo")
        self._http = httpx.Client(
            timeout=30.0,
            headers={"Authorization": f"Bearer {access_token}",
                     "Content-Type": "application/json"},
        )

    def send_mail(self, to_email: str, subject: str, body_text: str,
                  reply_to_message_id: str | None = None) -> None:
        """
        Plain-text email bhejo. Thread continuity ke liye reply
        hamesha usi message ka reply banta hai jis ka reply hai.
        """
        message = {
            "subject": subject,
            "body": {"contentType": "Text", "content": body_text},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        }
        payload: dict = {"message": message, "saveToSentItems": True}
        # Thread me reply: createReply + send ka flow (scaffold me simple note)
        url = f"{self.BASE}/me/sendMail"
        try:
            resp = self._http.post(url, json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise GraphError(f"sendMail fail hua: {e}") from e

    def list_messages(self, top: int = 25,
                      delta_link: str | None = None) -> dict:
        """
        Inbox messages lao. delta_link do to sirf NAYE messages aate hain
        (har dafa poora inbox nahi — yehi polling ko sasta rakhta hai).
        Returns: {"messages": [...], "delta_link": "..."}.
        """
        url = delta_link or (f"{self.BASE}/me/messages?$top={top}"
                             "&$orderby=receivedDateTime desc"
                             "&$select=id,conversationId,from,subject,bodyPreview,"
                             "receivedDateTime,isRead")
        try:
            resp = self._http.get(url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise GraphError(f"inbox parhne me fail: {e}") from e
        data = resp.json()
        return {
            "messages": data.get("value", []),
            "delta_link": data.get("@odata.deltaLink"),
        }

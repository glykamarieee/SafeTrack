import os

from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()


_client: Client | None = None


def get_supabase() -> Client:
    """The service-role client, created on first use.

    /score needs no database access, so the service (and its tests) can start
    without SUPABASE_URL / SUPABASE_SERVICE_KEY; only /detect, /anomalies and
    train_model.py need them.
    """
    global _client

    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")

        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

        _client = create_client(url, key)

    return _client

"""Hermetic defaults shared by backend unit and contract tests.

The application intentionally reads the repository `.env` for normal runs.
Tests must never inherit live provider credentials from that file: doing so
would make an otherwise local unit test call an external model and become
non-deterministic.
"""

import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def disable_live_external_credentials(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "data_egov_api_key", "")

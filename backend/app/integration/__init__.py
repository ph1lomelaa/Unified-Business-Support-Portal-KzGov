"""Integration bus package (Фаза 1).

Public entry point:

    from app.integration import bus
    envelope = bus.call(db, "gbd-ul", "company.prefill", {"bin": "..."})

Everything the portal exchanges with an external system goes through here.
"""

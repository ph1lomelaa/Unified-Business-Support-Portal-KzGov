from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"), extra="ignore"
    )

    # SQLite database file (spec: SQLite acceptable, ORM-agnostic)
    database_url: str = f"sqlite:///{BASE_DIR / 'eppb.db'}"

    # CORS — comma-separated list of allowed frontend origins. Needs every
    # host:port the browser actually loads the app from: localhost:3000 for
    # `make frontend`, localhost:3007 for the docker-compose port mapping.
    frontend_origin: str = "http://localhost:3000,http://localhost:3007"

    # LLM-провайдер (M4). Пусто у обоих -> AI-роуты на детерминированном фолбэке.
    # Приоритет: если задан ANTHROPIC_API_KEY — Claude; иначе, если задан
    # OPENAI_API_KEY — OpenAI (совместимый адаптер, см. ai/client.py).
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-4-6"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Optional key for the data.egov.kz integration adapter.
    data_egov_api_key: str = ""

    # Session cookie signing (demo)
    session_secret: str = "eppb-dev-secret-change-me"
    session_cookie: str = "eppb_session"

    # Uploaded files / generated PDFs
    upload_dir: Path = BASE_DIR / "storage"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)

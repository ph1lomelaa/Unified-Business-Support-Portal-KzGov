# Единый портал поддержки бизнеса (ЕППБ)

ЕППБ — это веб-платформа для публикации мер поддержки предпринимателей, подачи заявок, личного кабинета и админ-конструктора услуг.

## Материалы проекта

- MVP Website: https://eppb-baiterek-muslima.duckdns.org
- Архитектура: [ARCHITECTURE.md](ARCHITECTURE.md)
- Полный отчет: (https://docs.google.com/document/d/1DdgZumSBnLMH1dwsiRFAbcMgsGATzW2_j2hEOxnG06Q/edit?usp=sharing)

## Как быстро посмотреть проект

1. Откройте `https://eppb-baiterek-muslima.duckdns.org`
2. Просмотрите каталог услуг: `https://eppb-baiterek-muslima.duckdns.org/services`
3. Перейдите в карточку услуги и нажмите «Подать заявку»
4. Откройте админку: `https://eppb-baiterek-muslima.duckdns.org/admin`
5. Проверьте карту: `https://eppb-baiterek-muslima.duckdns.org/map`
6. Проверьте аналитику: `https://eppb-baiterek-muslima.duckdns.org/reports`

## Что умеет система

- Публичный каталог мер и услуг поддержки бизнеса
- Подбор мер по параметрам и условиям
- Карточки услуг с требованиями, документами и этапами
- Многоэтапная заявка на базе SurveyJS
- Личный кабинет предпринимателя с отслеживанием статуса
- Админка с конструктором форм и управлением услугами
- AI-помощь для подбора услуг и проверки заявки
- Модуль аналитики и интерактивная карта проектов
- Имитация интеграций: BIN/ИИН, ЭЦП, внешние справочники

## Стек

- Frontend: Next.js 16.2, React 19.2, TypeScript, Tailwind-подобные утилиты
- Backend: Python 3, FastAPI, SQLModel, PostgreSQL, Uvicorn
- Формы: SurveyJS / survey-creator-react
- AI: Claude/OpenAI-ready, детерминированный fallback для демо
- DevOps: Docker Compose

## Структура репозитория

```
hackaton/
├── backend/            # FastAPI сервис, модели, API, seed-скрипты
├── frontend/           # Next.js приложение с публичной и админской частью
├── docker-compose.yml  # локальный стек: postgres + backend + frontend
├── docs/               # архитектура, документация, инструкция по конструктору
├── assets/             # брендовые ресурсы и графика
├── content/            # тексты, чек-листы, шаблоны
└── README.md           # этот файл
```

## Быстрый старт через Docker

```bash
cd /Users/muslimakosmagambetova/Downloads/hackaton
docker compose up --build
```

После запуска:
- фронтенд: `https://eppb-baiterek-muslima.duckdns.org`
- backend API: `https://eppb-baiterek-muslima.duckdns.org`
- OpenAPI: `https://eppb-baiterek-muslima.duckdns.org/api-docs`
- health: `https://eppb-baiterek-muslima.duckdns.org/health`

## Переменные окружения

Скопируйте `.env.example` в `backend/.env` и заполните нужные поля.

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — параметры PostgreSQL
- `DATABASE_URL` — строка подключения при локальном backend запуске
- `FRONTEND_ORIGIN` — разрешённые origin для CORS
- `BACKEND_ORIGIN` — URL backend для frontend вне Docker
- `ANTHROPIC_API_KEY` — ключ для AI (если пусто, используется fallback)
- `AI_MODEL` — модель Anthropic
- `DATA_EGOV_API_KEY` — ключ для открытых данных eGov
- `SESSION_SECRET` — секрет для сессий

## Локальная разработка без полного Docker-стека

### Backend-only

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend-only

```bash
cd frontend
npm install
npm run dev -- -p 3000
```

Если frontend запускается локально, убедитесь, что `BACKEND_ORIGIN` в `backend/.env` указан как `https://eppb-baiterek-muslima.duckdns.org`.

## Полезные endpoint'ы

- `GET /api/v1/services` — каталог услуг
- `GET /api/v1/services/{slug}` — карточка услуги
- `GET /api/v1/services/{slug}/form` — форма заявки
- `POST /api/v1/applications` — создание заявки
- `POST /api/v1/applications/{app_id}/submit` — отправка заявки
- `GET /api/v1/map/regions` — данные карты
- `POST /api/ai/navigate` — AI-подбор
- `POST /api/ai/check-application` — AI-проверка заявки

## Если что-то не работает

- проверьте, что backend поднят на `https://eppb-baiterek-muslima.duckdns.org`
- проверьте логи: `docker compose logs -f backend` и `docker compose logs -f frontend`
- проверьте `backend/.env` и `FRONTEND_ORIGIN`

## Контакт

- Email: [muslima5671@gmail.com]
- Телефон: [+7 707 476 05 69]
- Домашний домен: https://eppb-baiterek-muslima.duckdns.org



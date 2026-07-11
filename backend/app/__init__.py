import warnings

# `schema` is a meaningful domain field (SurveyJS form schema) that intentionally
# shadows the deprecated Pydantic/SQLModel `.schema()` helper. Silence the noise.
warnings.filterwarnings(
    "ignore", message='Field name "schema".*', category=UserWarning
)

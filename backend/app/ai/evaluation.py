"""Fixed, versioned evaluation set for the service navigator."""

NAVIGATION_CASES = [
    {"query": "Нужен кредит на покупку скота для фермы", "expectedSlug": "akk-animal"},
    {"query": "Хочу приобрести грузовые вагоны в лизинг", "expectedSlug": "brk-wagons-leasing"},
    {"query": "Не хватает залога для банковского кредита", "expectedSlug": "damu-guarantee"},
    {"query": "Нужно застраховать экспортный контракт", "expectedSlug": "kazakhexport-insurance"},
    {"query": "Хочу снизить процентную ставку по кредиту", "expectedSlug": "damu-subsidy"},
]

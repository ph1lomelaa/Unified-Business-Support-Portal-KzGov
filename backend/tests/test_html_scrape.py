from app.sources.html_scrape import HtmlScrapeAdapter, KafSubsidyAdapter


def test_damu_adapter_extracts_program_cards():
    adapter = HtmlScrapeAdapter(
        source_id="damu",
        organization="Даму",
        listing_url="https://damu.kz/programmi/",
        block_class="program-card",
        title_tags={"h5"},
    )
    html = """
    <div class="program-card"><h5>Льготное финансирование</h5>
    <p>Ставка и условия программы.</p><a href="/programmi/loan">Подробнее</a></div>
    """

    rows = adapter.extract(html)

    assert len(rows) == 1
    assert rows[0].title == "Льготное финансирование"
    assert rows[0].url == "https://damu.kz/programmi/loan"
    assert "условия" in rows[0].text


def test_kaf_adapter_keeps_each_subsidy_section():
    html = """
    <div class="subsidies"><p class="subsidies-title">Первая субсидия</p>
    <p>Условия первой программы.</p><a href="/file-one.doc">Документ</a>
    <div class="subsidies"><p class="subsidies-title">Вторая субсидия</p>
    <p>Условия второй программы.</p><a href="/file-two.doc">Документ</a>
    """

    rows = KafSubsidyAdapter().extract(html)

    assert [row.title for row in rows] == ["Первая субсидия", "Вторая субсидия"]
    assert rows[1].url == "https://kaf.kz/file-two.doc"

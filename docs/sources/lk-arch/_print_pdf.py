"""Print the integrations HTML to a landscape A4 PDF after Mermaid renders."""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "lk-external-integrations.html"
PDF = ROOT / "lk-external-integrations.pdf"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        page = browser.new_page()
        page.emulate_media(media="print")
        page.goto(HTML.as_uri(), wait_until="load", timeout=60_000)
        page.wait_for_selector("body[data-diagrams-ready='true']", timeout=60_000)
        page.wait_for_timeout(500)
        page.pdf(
            path=str(PDF),
            format="A4",
            landscape=True,
            print_background=True,
            prefer_css_page_size=True,
            scale=0.92,
            display_header_footer=True,
            header_template=(
                '<div style="font-size:9px; color:#4a5568; width:100%; padding:0 14mm;">'
                "БЖФ · Внешние интеграции ЛК</div>"
            ),
            footer_template=(
                '<div style="font-size:9px; color:#4a5568; width:100%; padding:0 14mm; '
                'display:flex; justify-content:space-between;"><span>AS-IS, 28.08.2026</span>'
                '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
            ),
            margin={"top": "14mm", "bottom": "16mm", "left": "10mm", "right": "10mm"},
        )
        browser.close()

    import pymupdf

    doc = pymupdf.open(PDF)
    while doc.page_count > 1 and len(doc[-1].get_text().strip()) < 80:
        doc.delete_page(doc.page_count - 1)
    tmp = PDF.with_suffix(".tmp.pdf")
    doc.save(tmp)
    doc.close()
    tmp.replace(PDF)
    print(f"Wrote {PDF} ({PDF.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

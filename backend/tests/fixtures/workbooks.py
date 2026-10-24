from io import BytesIO

from openpyxl import load_workbook

from app.scripts.generate_demo_workbooks import workbook_bytes


def mutate(content, change):
    with BytesIO(content) as stream:
        book = load_workbook(stream)
        change(book)
        return workbook_bytes(book)

# Local data

Existing internal workbooks are in `sample_files/`. Leave them unchanged. The proposed reference path `samples/` is not used in this checkout.

`outputs/` holds local inspection/verification metadata, `local/` is the default SQLite location, and `demo/` holds generated fictional workbooks. Everything under `data/` except this README is ignored by Git. Excel files are also ignored elsewhere in the repository. Original workbooks remain unchanged.

An uploaded workbook's metadata and raw evidence are stored in the configured local database; uploaded binary files are not retained by the API. Do not copy the database into a fresh demo clone. Create a new database through Alembic, then generate synthetic workbooks with `python -m app.scripts.generate_demo_workbooks --output data/demo` using the installed backend environment from the clone root. This generator does not read company files.

Use synthetic examples for committed tests and public demonstrations unless internal-data use has been explicitly approved. The workbook inspector masks free text and object names, but its output remains internal metadata.

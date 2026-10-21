from pathlib import Path
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]

INPUT_DIR = BASE_DIR / "data" / "input"
PROCESSED_DIR = BASE_DIR / "data" / "processed"

INPUT_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def save_uploaded_file(filename: str, content: bytes) -> Path:
    """
    Save an uploaded CSV or JSON file to the input directory.
    """

    safe_filename = Path(filename).name
    file_path = INPUT_DIR / safe_filename

    with open(file_path, "wb") as file:
        file.write(content)

    return file_path


def read_dataset(file_path: Path) -> pd.DataFrame:
    """
    Read CSV or JSON dataset using Pandas.
    """

    extension = file_path.suffix.lower()

    if extension == ".csv":
        return pd.read_csv(file_path)

    if extension == ".json":
        return pd.read_json(file_path)

    raise ValueError("Only CSV and JSON files are supported.")
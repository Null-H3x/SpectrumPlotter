import os
import subprocess
from dotenv import load_dotenv

# Load .env file
load_dotenv()

DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not all([DB_NAME, DB_USER, DB_PASSWORD]):
    raise Exception("Missing DB_NAME, DB_USER, or DB_PASSWORD in .env")

def run_sql(sql):
    subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-c", sql],
        check=True
    )

print("Creating database...")
run_sql(f"CREATE DATABASE {DB_NAME};")

print("Creating user...")
run_sql(
    f"CREATE USER {DB_USER} WITH ENCRYPTED PASSWORD '{DB_PASSWORD}';"
)

print("Granting privileges...")
run_sql(
    f"GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};"
)

print("Done.")
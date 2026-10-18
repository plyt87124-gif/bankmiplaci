import json, sys
sys.path.insert(0, "data/candidates/_src")
from lib import write
for f in ["data/candidates/erste-konto-smart-700.json", "data/candidates/bnp-podroznik-z-aplikacja-2.json", "data/candidates/alior-mlodzi-zyskuja.json"]:
    d = json.load(open(f, encoding="utf-8"))
    write(f, d)

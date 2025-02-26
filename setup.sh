uv venv
source .venv/bin/activate
uv pip install -e . umap-learn torch
python producer_embeddings.py
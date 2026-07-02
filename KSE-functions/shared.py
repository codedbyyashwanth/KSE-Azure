import os
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import AzureSearch

SEARCH_ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"]
SEARCH_KEY = os.environ["AZURE_SEARCH_KEY"]
SEARCH_INDEX_NAME = "kse-chunks"

# 1536-dim vectors, must match AI Search index config
embeddings = OpenAIEmbeddings(model="text-embedding-3-small", timeout=15)

# shared client used by both ingestion.py and query.py
vector_store = AzureSearch(
    azure_search_endpoint=SEARCH_ENDPOINT,
    azure_search_key=SEARCH_KEY,
    index_name=SEARCH_INDEX_NAME,
    embedding_function=embeddings.embed_query,
)
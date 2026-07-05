import os
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import AzureSearch
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

SEARCH_ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"]
SEARCH_KEY = os.environ["AZURE_SEARCH_KEY"]
SEARCH_INDEX_NAME = "kse-chunks"

embeddings = OpenAIEmbeddings(model="text-embedding-3-small", timeout=15)

# used by ingestion.py to embed + upsert chunks
vector_store = AzureSearch(
    azure_search_endpoint=SEARCH_ENDPOINT,
    azure_search_key=SEARCH_KEY,
    index_name=SEARCH_INDEX_NAME,
    embedding_function=embeddings,
)

# used by status.py for cheap key lookups — no embeddings, no vector math
search_client = SearchClient(
    endpoint=SEARCH_ENDPOINT,
    index_name=SEARCH_INDEX_NAME,
    credential=AzureKeyCredential(SEARCH_KEY),
)
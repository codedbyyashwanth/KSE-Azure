import logging
import json

import azure.functions as func
# native streaming preview, NOT full FastAPI-via-ASGI (that buffers responses)
from azurefunctions.extensions.http.fastapi import Request, StreamingResponse
from fastapi.responses import JSONResponse
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from shared import vector_store

bp = func.Blueprint()

TOP_K_CHUNKS = 4

# TODO: replace with your Static Web App URL once deployed
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=True, timeout=30)

RAG_SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions using only the provided context. "
    "If the context doesn't contain the answer, say you don't know — don't make one up."
)


async def generate_answer_stream(question: str):
    logging.info(f"Query received: {question}")

    docs = vector_store.similarity_search(question, k=TOP_K_CHUNKS)
    logging.info(f"Retrieved {len(docs)} chunks")
    context = "\n\n---\n\n".join(d.page_content for d in docs)

    messages = [
        SystemMessage(content=RAG_SYSTEM_PROMPT),
        HumanMessage(content=f"Context:\n{context}\n\nQuestion: {question}"),
    ]

    # astream = token-by-token generation, not a full wait-then-return
    async for chunk in llm.astream(messages):
        if chunk.content:
            payload = json.dumps({"token": chunk.content})
            yield f"data: {payload}\n\n"

    yield "data: [DONE]\n\n"


@bp.route(route="query", methods=[func.HttpMethod.POST, func.HttpMethod.OPTIONS])
async def query_http_trigger(req: Request) -> StreamingResponse:
    if req.method == "OPTIONS":
        # preflight — no body, just CORS headers
        async def empty():
            return
            yield

        return StreamingResponse(empty(), status_code=204, headers=CORS_HEADERS)

    body = await req.json()
    question = body.get("question")

    if not question:
        async def error_stream():
            yield f"data: {json.dumps({'error': 'Missing question field'})}\n\n"
        return StreamingResponse(
            error_stream(), media_type="text/event-stream", headers=CORS_HEADERS
        )

    return StreamingResponse(
        generate_answer_stream(question),
        media_type="text/event-stream",
        headers=CORS_HEADERS,
    )

@bp.route(route="check-indexed", methods=["GET"])
async def check_indexed(req: Request) -> JSONResponse:
    doc_name = req.query_params.get("doc_name")
    if not doc_name:
        return JSONResponse({"error": "doc_name is required"}, status_code=400)

    results = vector_store.similarity_search(
        doc_name, k=1, filters=f"metadata/doc_name eq '{doc_name}'"
    )
    return JSONResponse({"indexed": len(results) > 0})
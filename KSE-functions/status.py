import azure.functions as func
from azurefunctions.extensions.http.fastapi import Request, JSONResponse
from azure.core.exceptions import ResourceNotFoundError
from shared import search_client
from ingestion import make_chunk_id

bp = func.Blueprint()

CORS_HEADERS = {"Access-Control-Allow-Origin": "*"}

@bp.route(route="status", methods=["GET"])
async def get_status(req: Request) -> JSONResponse:
    doc_name = req.query_params.get("doc_name")
    if not doc_name:
        return JSONResponse({"error": "doc_name is required"}, status_code=400, headers=CORS_HEADERS)

    chunk_id = make_chunk_id(doc_name, 0)
    try:
        search_client.get_document(key=chunk_id)
        return JSONResponse({"status": "success"}, headers=CORS_HEADERS)
    except ResourceNotFoundError:
        return JSONResponse({"status": "processing"}, headers=CORS_HEADERS)
    except Exception:
        # index itself may not exist yet, or a transient Search error — treat as still-processing, don't crash the poll
        return JSONResponse({"status": "processing"}, headers=CORS_HEADERS)
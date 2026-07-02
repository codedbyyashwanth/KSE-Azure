import os
import uuid
from datetime import datetime, timedelta, timezone
import azure.functions as func
from azurefunctions.extensions.http.fastapi import Request, JSONResponse
from azure.storage.blob import BlobSasPermissions, generate_blob_sas

bp = func.Blueprint()

CONTAINER_NAME = "documents"

@bp.route(route="upload-sas", methods=["POST"])
async def get_upload_sas(req: Request) -> JSONResponse:
    body = await req.json()
    original_name = body.get("filename")
    if not original_name:
        return JSONResponse({"error": "filename is required"}, status_code=400)

    ext = os.path.splitext(original_name)[1]
    blob_name = f"{uuid.uuid4()}{ext}"

    account_name = os.environ["STORAGE_ACCOUNT_NAME"]
    account_key = os.environ["STORAGE_ACCOUNT_KEY"]

    expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=CONTAINER_NAME,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(write=True, create=True),
        expiry=expiry,
    )

    upload_url = (
        f"https://{account_name}.blob.core.windows.net/"
        f"{CONTAINER_NAME}/{blob_name}?{sas_token}"
    )

    return JSONResponse(
        {"uploadUrl": upload_url, "blobName": blob_name},
        headers={"Access-Control-Allow-Origin": "*"},
    )
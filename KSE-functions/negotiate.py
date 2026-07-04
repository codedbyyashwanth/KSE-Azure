import azure.functions as func
from azurefunctions.extensions.http.fastapi import Request, Response

bp = func.Blueprint()

CORS_HEADERS = {"Access-Control-Allow-Origin": "*"}


@bp.generic_input_binding(
    arg_name="connectionInfo",
    type="signalRConnectionInfo",
    hubName="ingestion",
    connectionStringSetting="AzureSignalRConnectionString",
)
@bp.route(route="negotiate", methods=["POST", "OPTIONS"])
async def negotiate(req: Request, connectionInfo) -> Response:
    if req.method == "OPTIONS":
        return Response(content="", status_code=204, headers=CORS_HEADERS)

    return Response(
        content=connectionInfo,
        media_type="application/json",
        headers=CORS_HEADERS,
    )
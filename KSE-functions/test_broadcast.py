# test_broadcast.py
import json
import azure.functions as func
from azurefunctions.extensions.http.fastapi import Request, Response

bp = func.Blueprint()

@bp.generic_output_binding(
    arg_name="signalRMessages",
    type="signalR",
    hubName="ingestion",
    connectionStringSetting="AzureSignalRConnectionString",
)
@bp.route(route="test-broadcast", methods=["GET"])
async def test_broadcast(req: Request, signalRMessages: func.Out[str]) -> Response:
    signalRMessages.set(json.dumps({
        "target": "docIndexed",
        "arguments": [{"docName": "test-doc.pdf"}],
    }))
    return Response(content="sent", media_type="text/plain", headers={"Access-Control-Allow-Origin": "*"})
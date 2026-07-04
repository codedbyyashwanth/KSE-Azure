import azure.functions as func
from ingestion import bp as ingestion_bp
from query import bp as query_bp
from upload_sas import bp as upload_sas_bp
from negotiate import bp as negotiate_bp
from test_broadcast import bp as test_bp   

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

app.register_functions(ingestion_bp)
app.register_functions(query_bp)
app.register_functions(upload_sas_bp)
app.register_functions(negotiate_bp)
app.register_functions(test_bp)
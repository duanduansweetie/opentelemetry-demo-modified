import requests, time  
step="60s"  
end_time = time.time()  
start_time = end_time - 3600  
url = "http://localhost:9090/api/v1/query_range"  
q = """ >> test_prom.py & echo (sum(rate(http_server_duration_milliseconds_count{http_status_code=~"5.."}[5m])) by (service_name) or sum(rate(rpc_server_duration_milliseconds_count{rpc_grpc_status_code!="0"}[5m])) by (service_name) or sum(rate(traces_span_metrics_calls_total{status_code="STATUS_CODE_ERROR"}[5m])) by (service_name)) / (sum(rate(http_server_duration_milliseconds_count[5m])) by (service_name) or sum(rate(rpc_server_duration_milliseconds_count[5m])) by (service_name) or sum(rate(traces_span_metrics_calls_total[5m])) by (service_name))"""  
params = {"query": q, "start": start_time, "end": end_time, "step": step}  
res = requests.get(url, params=params, timeout=10)  
print(res.status_code, res.text[:200])  

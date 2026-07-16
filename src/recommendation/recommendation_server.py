#!/usr/bin/python

# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0


# Python
import logging
import os
import random
from concurrent import futures

import requests

# Pip
import grpc
from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import (
    OTLPLogExporter,
)
from opentelemetry.propagate import inject
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource

from openfeature import api
from openfeature.contrib.hook.opentelemetry import TracingHook
from openfeature.contrib.provider.flagd import FlagdProvider

# Local
import demo_pb2
import demo_pb2_grpc
from grpc_health.v1 import health_pb2
from grpc_health.v1 import health_pb2_grpc

cached_ids = []
first_run = True


class RecommendationService(demo_pb2_grpc.RecommendationServiceServicer):
    def ListRecommendations(self, request, context):
        metadata = dict(context.invocation_metadata())
        recursion_depth = int(metadata.get("x-recursion-depth", "0"))

        if recursion_depth == 0 and any_feature_enabled(
            "addCircularDependency", "archCircular"
        ):
            try:
                frontend_addr = os.environ.get("FRONTEND_ADDR", "frontend:8080")
                frontend_url = f"http://{frontend_addr}/api/currency"
                headers = {"x-recursion-depth": "1"}
                inject(headers)

                # Make the reverse recommendation -> frontend hop explicit in traces
                # so Jaeger can surface the cycle reliably.
                with tracer.start_as_current_span(
                    "frontend-callback", kind=trace.SpanKind.CLIENT
                ) as callback_span:
                    callback_span.set_attribute("http.request.method", "GET")
                    callback_span.set_attribute("url.full", frontend_url)
                    callback_span.set_attribute(
                        "server.address", frontend_addr.split(":", 1)[0]
                    )
                    response = requests.get(frontend_url, timeout=2, headers=headers)
                    callback_span.set_attribute(
                        "http.response.status_code", response.status_code
                    )

                logger.info(
                    "Circular callback to frontend completed with status %s",
                    response.status_code,
                )
            except Exception as exc:
                logger.warning("Circular callback to frontend failed: %s", exc)

        # Inject unstable dependency failures.
        if random.random() < 0.3 and any_feature_enabled("addErrorRate", "archCrash"):
            rec_svc_metrics["recommendation_errors_counter"].add(
                1, {"error.type": "fault_injection"}
            )
            context.abort(
                grpc.StatusCode.INTERNAL,
                "Injected Fault: Recommendation service random failure",
            )

        prod_list = get_product_list(request.product_ids)
        span = trace.get_current_span()
        span.set_attribute("app.products_recommended.count", len(prod_list))
        logger.info("Receive ListRecommendations for product ids:%s", prod_list)

        response = demo_pb2.ListRecommendationsResponse()
        response.product_ids.extend(prod_list)

        rec_svc_metrics["app_recommendations_counter"].add(
            len(prod_list), {"recommendation.type": "catalog"}
        )

        return response

    def Check(self, request, context):
        return health_pb2.HealthCheckResponse(
            status=health_pb2.HealthCheckResponse.SERVING
        )

    def Watch(self, request, context):
        return health_pb2.HealthCheckResponse(
            status=health_pb2.HealthCheckResponse.UNIMPLEMENTED
        )


def get_product_list(request_product_ids):
    global first_run
    global cached_ids
    with tracer.start_as_current_span("get_product_list") as span:
        max_responses = 5

        request_product_ids_str = "".join(request_product_ids)
        request_product_ids = request_product_ids_str.split(",")

        if check_feature_flag("recommendationCacheFailure"):
            span.set_attribute("app.recommendation.cache_enabled", True)
            if random.random() < 0.5 or first_run:
                first_run = False
                span.set_attribute("app.cache_hit", False)
                logger.info("get_product_list: cache miss")
                cat_response = product_catalog_stub.GetProduct(demo_pb2.Empty())
                response_ids = [x.id for x in cat_response.products]
                cached_ids = cached_ids + response_ids
                cached_ids = cached_ids + cached_ids[: len(cached_ids) // 4]
                product_ids = cached_ids
            else:
                span.set_attribute("app.cache_hit", True)
                logger.info("get_product_list: cache hit")
                product_ids = cached_ids
        else:
            span.set_attribute("app.recommendation.cache_enabled", False)
            cat_response = product_catalog_stub.ListProducts(demo_pb2.Empty())
            product_ids = [x.id for x in cat_response.products]

        span.set_attribute("app.products.count", len(product_ids))

        filtered_products = list(set(product_ids) - set(request_product_ids))
        num_products = len(filtered_products)
        span.set_attribute("app.filtered_products.count", num_products)
        num_return = min(max_responses, num_products)

        indices = random.sample(range(num_products), num_return)
        prod_list = [filtered_products[i] for i in indices]

        span.set_attribute("app.filtered_products.list", prod_list)

        return prod_list


def must_map_env(key: str):
    value = os.environ.get(key)
    if value is None:
        raise Exception(f"{key} environment variable must be set")
    return value


def init_metrics(meter):
    rec_svc_metrics = {
        "app_recommendations_counter": meter.create_counter(
            "app_recommendations_counter",
            description="The number of recommendations generated",
            unit="1",
        ),
        "recommendation_errors_counter": meter.create_counter(
            "recommendation_errors_counter",
            description="The number of recommendation errors",
            unit="1",
        ),
    }
    return rec_svc_metrics


def check_feature_flag(flag_name: str):
    client = api.get_client()
    return client.get_boolean_value(flag_name, False)


def any_feature_enabled(*flag_names: str):
    return any(check_feature_flag(flag_name) for flag_name in flag_names)


if __name__ == "__main__":
    service_name = must_map_env("OTEL_SERVICE_NAME")
    api.set_provider(
        FlagdProvider(
            host=os.environ.get("FLAGD_HOST", "flagd"),
            port=int(os.environ.get("FLAGD_PORT", "8013")),
        )
    )
    api.add_hooks([TracingHook()])

    tracer = trace.get_tracer_provider().get_tracer(service_name)
    meter = metrics.get_meter_provider().get_meter(service_name)
    rec_svc_metrics = init_metrics(meter)

    logger_provider = LoggerProvider(
        resource=Resource.create(
            {
                "service.name": service_name,
            }
        ),
    )
    set_logger_provider(logger_provider)
    log_exporter = OTLPLogExporter(insecure=True)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    handler = LoggingHandler(level=logging.NOTSET, logger_provider=logger_provider)

    logger = logging.getLogger("main")
    logger.addHandler(handler)

    catalog_addr = must_map_env("PRODUCT_CATALOG_ADDR")
    pc_channel = grpc.insecure_channel(catalog_addr)
    product_catalog_stub = demo_pb2_grpc.ProductCatalogServiceStub(pc_channel)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    service = RecommendationService()
    demo_pb2_grpc.add_RecommendationServiceServicer_to_server(service, server)
    health_pb2_grpc.add_HealthServicer_to_server(service, server)

    port = must_map_env("RECOMMENDATION_PORT")
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    logger.info("Recommendation service started, listening on port %s", port)
    server.wait_for_termination()

#!/usr/bin/python

# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0

def init_metrics(meter):

    # Recommendations counter
    app_recommendations_counter = meter.create_counter(
        'app_recommendations_counter', unit='recommendations', description="Counts the total number of given recommendations"
    )

    # Recommendation errors counter
    recommendation_errors_counter = meter.create_counter(
        'recommendation_errors_counter', unit='errors', description="Counts the number of recommendation errors"
    )

    rec_svc_metrics = {
        "app_recommendations_counter": app_recommendations_counter,
        "recommendation_errors_counter": recommendation_errors_counter,
    }

    return rec_svc_metrics

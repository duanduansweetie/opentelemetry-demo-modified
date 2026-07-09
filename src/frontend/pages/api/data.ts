// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import type { NextApiRequest, NextApiResponse } from 'next';
import InstrumentationMiddleware from '../../utils/telemetry/InstrumentationMiddleware';
import AdGateway from '../../gateways/rpc/Ad.gateway';
import CurrencyGateway from '../../gateways/rpc/Currency.gateway';
import ProductCatalogGateway from '../../gateways/rpc/ProductCatalog.gateway';
import ProductReviewGateway from '../../gateways/rpc/ProductReview.gateway';
import RecommendationsGateway from '../../gateways/rpc/Recommendations.gateway';
import { Ad, Empty } from '../../protos/demo';

type TResponse = Ad[] | Empty;

const resolveBooleanFlag = async (flagKey: string): Promise<boolean> => {
  try {
    const flagdHost = process.env.FLAGD_HOST || 'flagd';
    const flagdPort = process.env.FLAGD_PORT || '8013';
    const flagRes = await fetch(`http://${flagdHost}:${flagdPort}/flagd.evaluation.v1.Service/ResolveBoolean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagKey }),
    });
    const flagData = await flagRes.json();
    return flagData.value === true;
  } catch (err) {
    console.error(`Failed to check ${flagKey} flag`, err);
    return false;
  }
};

const handler = async ({ method, query }: NextApiRequest, res: NextApiResponse<TResponse>) => {
  switch (method) {
    case 'GET': {
      const { contextKeys = [] } = query;
      const keys = Array.isArray(contextKeys) ? contextKeys : contextKeys.split(',');

      const highQPSEnabled = await resolveBooleanFlag('highQPS');
      const archSpikeEnabled = await resolveBooleanFlag('archSpike');
      const archNPlusOneEnabled = await resolveBooleanFlag('archNPlusOne');
      const archMonolithEnabled = await resolveBooleanFlag('archMonolith');

      if (highQPSEnabled || archSpikeEnabled) {
        for (let i = 0; i < 4; i++) {
          await AdGateway.listAds(keys);
        }
      }

      // N+1 demo: split one logical ad request into per-key downstream calls.
      if (archNPlusOneEnabled) {
        for (const key of keys) {
          await AdGateway.listAds([key]);
        }
      }

      if (archMonolithEnabled) {
        const productIds = ['0PUK6V6EV0', '1YMWWN1N4O', '2ZYFJ3GM2N'];

        await Promise.allSettled([
          CurrencyGateway.getSupportedCurrencies(),
          ProductCatalogGateway.listProducts(),
          RecommendationsGateway.listRecommendations('arch-monolith-demo-user', productIds),
          ProductReviewGateway.getProductReviews(productIds[0]),
          ProductReviewGateway.getAverageProductReviewScore(productIds[0]),
        ]);

        // CPU busy work makes the frontend look like an oversized aggregation service.
        const end = Date.now() + 250;
        while (Date.now() < end) {
          Math.sqrt(Math.random() * Number.MAX_SAFE_INTEGER);
        }
      }

      const { ads: adList } = await AdGateway.listAds(keys);

      return res.status(200).json(adList);
    }

    default: {
      return res.status(405).send('');
    }
  }
};

export default InstrumentationMiddleware(handler);

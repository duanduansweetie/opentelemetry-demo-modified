// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import type { NextApiRequest, NextApiResponse } from 'next';
import InstrumentationMiddleware from '../../utils/telemetry/InstrumentationMiddleware';
import AdGateway from '../../gateways/rpc/Ad.gateway';
import { Ad, Empty } from '../../protos/demo';

type TResponse = Ad[] | Empty;

const handler = async ({ method, query }: NextApiRequest, res: NextApiResponse<TResponse>) => {
  switch (method) {
    case 'GET': {
      const { contextKeys = [] } = query;
      const keys = Array.isArray(contextKeys) ? contextKeys : contextKeys.split(',');

      // 判断 flagd 开关 highQPS 是否开启
      let highQPSEnabled = false;
      try {
        const flagdHost = process.env.FLAGD_HOST || 'flagd';
        const flagdPort = process.env.FLAGD_PORT || '8013';
        const flagRes = await fetch(`http://${flagdHost}:${flagdPort}/flagd.evaluation.v1.Service/ResolveBoolean`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flagKey: 'highQPS' })
        });
        const flagData = await flagRes.json();
        if (flagData.value === true) {
          highQPSEnabled = true;
        }
      } catch (err) {
        console.error('Failed to check highQPS flag', err);
      }

      // 请求流量异常：frontend加载推荐商品时会调用这个接口多次，模拟QPS异常的情况
      if (highQPSEnabled) {
        for (let i = 0; i < 4; i++) {
          await AdGateway.listAds(keys);
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

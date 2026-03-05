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

      // 请求流量异常：frontend加载推荐商品时会调用这个接口多次，模拟QPS异常的情况
      for (let i = 0; i < 4; i++) {
        await AdGateway.listAds(keys);
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

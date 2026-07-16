// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { ChannelCredentials } from '@grpc/grpc-js';
import { ListRecommendationsResponse, RecommendationServiceClient } from '../../protos/demo';

const createClient = () =>
  new RecommendationServiceClient(process.env.RECOMMENDATION_ADDR || '', ChannelCredentials.createInsecure());

const RecommendationsGateway = () => ({
  listRecommendations(userId: string, productIds: string[]) {
    const client = createClient();
    return new Promise<ListRecommendationsResponse>((resolve, reject) =>
      client.listRecommendations({ userId, productIds }, (error, response) =>
        error ? reject(error) : resolve(response)
      )
    );
  },
});

export default RecommendationsGateway();

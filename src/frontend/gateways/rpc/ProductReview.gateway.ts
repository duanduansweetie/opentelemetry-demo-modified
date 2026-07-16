// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { ChannelCredentials } from '@grpc/grpc-js';
import {ProductReview, ProductReviewServiceClient} from '../../protos/demo';

const createClient = () =>
  new ProductReviewServiceClient(process.env.PRODUCT_REVIEWS_ADDR || '', ChannelCredentials.createInsecure());

const reviewsServiceConfigured = () => Boolean(process.env.PRODUCT_REVIEWS_ADDR);

const ProductReviewGateway = () => ({

    getProductReviews(productId: string) {
        if (!reviewsServiceConfigured()) {
            return Promise.resolve([]);
        }
        const client = createClient();
        return new Promise<ProductReview []>((resolve, reject) =>
            client.getProductReviews({ productId }, (error, response) => (error ? reject(error) : resolve(response.productReviews)))
        );
    },
    getAverageProductReviewScore(productId: string) {
        if (!reviewsServiceConfigured()) {
            return Promise.resolve('');
        }
        const client = createClient();
        return new Promise<string>((resolve, reject) =>
            client.getAverageProductReviewScore({ productId }, (error, response) => (error ? reject(error) : resolve(response.averageScore)))
        );
    },
    askProductAIAssistant(productId: string, question: string) {
        if (!reviewsServiceConfigured()) {
            return Promise.resolve('Product review assistant is unavailable in the current demo deployment.');
        }
        const client = createClient();
        return new Promise<string>((resolve, reject) =>
            client.askProductAiAssistant({ productId, question }, (error, response) => (error ? reject(error) : resolve(response.response)))
        );
    },
});

export default ProductReviewGateway();

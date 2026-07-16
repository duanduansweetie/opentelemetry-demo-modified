// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { ChannelCredentials } from '@grpc/grpc-js';
import { ListProductsResponse, Product, ProductCatalogServiceClient } from '../../protos/demo';

const createClient = () =>
  new ProductCatalogServiceClient(process.env.PRODUCT_CATALOG_ADDR || '', ChannelCredentials.createInsecure());

const ProductCatalogGateway = () => ({
  listProducts() {
    const client = createClient();
    return new Promise<ListProductsResponse>((resolve, reject) =>
      client.listProducts({}, (error, response) => (error ? reject(error) : resolve(response)))
    );
  },
  getProduct(id: string) {
    const client = createClient();
    return new Promise<Product>((resolve, reject) =>
      client.getProduct({ id }, (error, response) => (error ? reject(error) : resolve(response)))
    );
  },
});

export default ProductCatalogGateway();

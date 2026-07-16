// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { ChannelCredentials } from '@grpc/grpc-js';
import { Cart, CartItem, CartServiceClient, Empty } from '../../protos/demo';

const createClient = () =>
  new CartServiceClient(process.env.CART_ADDR || '', ChannelCredentials.createInsecure());

const CartGateway = () => ({
  getCart(userId: string) {
    const client = createClient();
    return new Promise<Cart>((resolve, reject) =>
      client.getCart({ userId }, (error, response) => (error ? reject(error) : resolve(response)))
    );
  },
  addItem(userId: string, item: CartItem) {
    const client = createClient();
    return new Promise<Empty>((resolve, reject) =>
      client.addItem({ userId, item }, (error, response) => (error ? reject(error) : resolve(response)))
    );
  },
  emptyCart(userId: string) {
    const client = createClient();
    return new Promise<Empty>((resolve, reject) =>
      client.emptyCart({ userId }, (error, response) => (error ? reject(error) : resolve(response)))
    );
  },
});

export default CartGateway();

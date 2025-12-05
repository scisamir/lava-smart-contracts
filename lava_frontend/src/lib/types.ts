export type UserOrderType = {
  amount: number,
  txHash: string,
  isOptIn: boolean,
  grandTotalOrders: number,
}

export interface OrderListProps {
  orders: UserOrderType[];
}

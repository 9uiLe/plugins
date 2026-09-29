from dataclasses import dataclass


@dataclass(frozen=True)
class Receipt:
    order_id: str
    charge_id: str


class CheckoutService:
    def __init__(self, orders, gateway):
        self.orders = orders
        self.gateway = gateway

    def checkout(self, order_id: str, amount: int) -> Receipt:
        existing = self.orders.find(order_id)
        if existing is not None:
            return existing
        charge_id = self.gateway.charge(order_id, amount)
        receipt = Receipt(order_id, charge_id)
        self.orders.save(receipt)
        return receipt

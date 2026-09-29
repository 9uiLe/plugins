from service import CheckoutService


class MemoryOrders:
    def __init__(self):
        self.receipts = {}

    def find(self, order_id):
        return self.receipts.get(order_id)

    def save(self, receipt):
        self.receipts[receipt.order_id] = receipt


class FakeGateway:
    def __init__(self):
        self.calls = []

    def charge(self, order_id, amount):
        self.calls.append((order_id, amount))
        return f"charge-{len(self.calls)}"


def test_checkout_saves_receipt():
    orders, gateway = MemoryOrders(), FakeGateway()
    receipt = CheckoutService(orders, gateway).checkout("order-1", 500)
    assert orders.find("order-1") == receipt
    assert gateway.calls == [("order-1", 500)]


def test_repeated_checkout_reuses_receipt():
    orders, gateway = MemoryOrders(), FakeGateway()
    service = CheckoutService(orders, gateway)
    first = service.checkout("order-1", 500)
    second = service.checkout("order-1", 500)
    assert second == first
    assert gateway.calls == [("order-1", 500)]

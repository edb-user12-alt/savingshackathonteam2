from pydantic import BaseModel
from typing import List, Optional, Any

class CustomerId(BaseModel):
    customer_id: str

class PurchaseRequest(BaseModel):
    customer_id: str
    product_id: str
    initial_deposit: float

class BigQueryPushData(BaseModel):
    customers: List[Any]
    accounts: List[Any]
    transactions: List[Any]

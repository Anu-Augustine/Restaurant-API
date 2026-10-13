
from sqlalchemy import Column, Integer, Float, String, ForeignKey
from database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    total_amount = Column(Float, nullable=False, default=0.0)

    status = Column(String(20), nullable=False, default="pending")

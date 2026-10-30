from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None

class SuccessResponse(BaseModel):
    message: str
    details: Optional[dict] = None

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

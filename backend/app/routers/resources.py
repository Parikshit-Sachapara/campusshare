import uuid
from typing import Optional, List
from datetime import date, datetime
from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile, Resource, ResourceCategory, Department, ResourceUnit, ResourceImage, UserRole, ResourceType, ResourceStatus
from ..schemas.resource import (
    ResourceCreate,
    ResourceUpdate,
    ResourceResponse,
    ResourceDetailResponse,
    ResourceUnitCreate,
    ResourceUnitSchema,
    EligibilityResponse,
    DateAvailabilityResponse,
    CalendarAvailabilityResponse,
)
from ..schemas.common import PaginatedResponse, SuccessResponse
from ..services.resource_service import ResourceService
from ..services.upload_service import UploadService
from ..core.deps import get_current_user, require_roles
from ..core.exceptions import CampusShareException

router = APIRouter(prefix="/resources", tags=["Campus Resources Catalog"])

def enrich_resource_response(res: Resource, db: Session) -> ResourceResponse:
    # Query primary image or first image
    primary_img = db.query(ResourceImage).filter_by(resource_id=res.id, is_primary=True).first()
    if not primary_img:
        primary_img = db.query(ResourceImage).filter_by(resource_id=res.id).order_by(ResourceImage.sort_order).first()

    # Available units
    active_units = db.query(ResourceUnit).filter_by(resource_id=res.id, is_active=True).count()

    cat_name = res.category.name if res.category else None
    dept_code = res.department.code if res.department else None
    owner_name = res.owner.full_name if res.owner else None

    return ResourceResponse(
        id=res.id,
        name=res.name,
        description=res.description,
        category_id=res.category_id,
        category_name=cat_name,
        department_id=res.department_id,
        department_code=dept_code,
        owner_id=res.owner_id,
        owner_name=owner_name,
        location=res.location,
        resource_type=res.resource_type,
        quantity=res.quantity,
        available_quantity=active_units or res.quantity,
        capacity=res.capacity,
        status=res.status,
        deposit_amount=float(res.deposit_amount or 0.0),
        approval_required=res.approval_required,
        training_required=res.training_required,
        is_restricted=res.is_restricted,
        min_booking_minutes=res.min_booking_minutes,
        max_booking_minutes=res.max_booking_minutes,
        slot_minutes=res.slot_minutes,
        advance_booking_days=res.advance_booking_days,
        popularity_count=res.popularity_count,
        primary_image_url=primary_img.url if primary_img else None,
        specifications=res.specifications or {},
        created_at=res.created_at,
        updated_at=res.updated_at,
    )

@router.get("", response_model=PaginatedResponse[ResourceResponse])
def list_resources(
    q: Optional[str] = Query(None, description="Search term for name, description, location (trigram + ILIKE)"),
    category_id: Optional[uuid.UUID] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    location: Optional[str] = Query(None),
    resource_type: Optional[ResourceType] = Query(None),
    status: Optional[ResourceStatus] = Query(None),
    sort_by: str = Query("popularity", pattern="^(popularity|recently_added|name)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    items, total = ResourceService.search_resources(
        db=db,
        q=q,
        category_id=category_id,
        department_id=department_id,
        location=location,
        resource_type=resource_type,
        status_filter=status,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )

    enriched_items = [enrich_resource_response(item, db) for item in items]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse(
        items=enriched_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    req: ResourceCreate,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    created = ResourceService.create_resource(db=db, data=req, owner=user, client_ip=client_ip)
    return enrich_resource_response(created, db)

@router.get("/{id}", response_model=ResourceDetailResponse)
def get_resource_details(id: uuid.UUID, db: Session = Depends(get_db)):
    res = ResourceService.get_resource_or_404(db, id)
    base_info = enrich_resource_response(res, db)

    images = res.images
    units = res.units
    rule = res.rule
    availabilities = res.availabilities
    blackouts = res.blackouts

    # Similar resources in same category or department
    similar_raw = db.query(Resource).filter(
        Resource.id != res.id,
        Resource.status != ResourceStatus.ARCHIVED,
        (Resource.category_id == res.category_id) | (Resource.department_id == res.department_id)
    ).limit(3).all()

    similar_enriched = [enrich_resource_response(s, db) for s in similar_raw]

    # Usage summary
    total_completed = db.query(Resource).filter_by(id=res.id).count() # placeholder for count of completed bookings
    usage_summary = {
        "popularity_rank": res.popularity_count,
        "total_units_count": len(units) if res.resource_type == ResourceType.EQUIPMENT else 1,
        "capacity": res.capacity if res.resource_type == ResourceType.FACILITY else None,
    }

    return ResourceDetailResponse(
        **base_info.model_dump(),
        images=images,
        units=units,
        rule=rule,
        availabilities=availabilities,
        blackouts=blackouts,
        similar_resources=similar_enriched,
        usage_summary=usage_summary,
    )

@router.patch("/{id}", response_model=ResourceResponse)
def update_resource(
    id: uuid.UUID,
    req: ResourceUpdate,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    updated = ResourceService.update_resource(db=db, resource_id=id, data=req, user=user, client_ip=client_ip)
    return enrich_resource_response(updated, db)

@router.delete("/{id}")
def delete_resource(
    id: uuid.UUID,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    result = ResourceService.archive_or_delete_resource(db=db, resource_id=id, user=user, client_ip=client_ip)
    return result

@router.get("/{id}/availability", response_model=DateAvailabilityResponse)
def get_availability_for_date(
    id: uuid.UUID,
    date_str: str = Query(..., alias="date", description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    try:
        parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise CampusShareException(code="INVALID_DATE_FORMAT", message="Date must be formatted as YYYY-MM-DD.", status_code=status.HTTP_400_BAD_REQUEST)

    res = ResourceService.get_resource_or_404(db, id)
    slots = ResourceService.get_date_availability(db=db, resource=res, target_date=parsed_date)

    return DateAvailabilityResponse(
        resource_id=res.id,
        date=date_str,
        slots=slots,
    )

@router.get("/{id}/calendar", response_model=CalendarAvailabilityResponse)
def get_calendar_30_days(id: uuid.UUID, db: Session = Depends(get_db)):
    res = ResourceService.get_resource_or_404(db, id)
    calendar_days = ResourceService.get_30_day_calendar(db=db, resource=res)
    return CalendarAvailabilityResponse(
        resource_id=res.id,
        days=calendar_days,
    )

@router.get("/{id}/eligibility", response_model=EligibilityResponse)
def check_eligibility(
    id: uuid.UUID,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    res = ResourceService.get_resource_or_404(db, id)
    eligibility = ResourceService.evaluate_eligibility(db=db, resource=res, user=user)
    return eligibility

@router.post("/{id}/images", response_model=SuccessResponse)
async def upload_images(
    id: uuid.UUID,
    files: List[UploadFile] = File(...),
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    created = await UploadService.upload_resource_images(db=db, resource_id=id, files=files)
    return SuccessResponse(message=f"Successfully uploaded {len(created)} image(s).")

@router.post("/{id}/units", response_model=ResourceUnitSchema, status_code=status.HTTP_201_CREATED)
def add_resource_unit(
    id: uuid.UUID,
    req: ResourceUnitCreate,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    res = ResourceService.get_resource_or_404(db, id)
    if res.resource_type == ResourceType.FACILITY:
        raise CampusShareException(code="INVALID_OPERATION", message="Facilities cannot have multiple units.", status_code=status.HTTP_400_BAD_REQUEST)

    existing_unit = db.query(ResourceUnit).filter_by(resource_id=res.id, unit_code=req.unit_code.strip()).first()
    if existing_unit:
        raise CampusShareException(code="UNIT_CODE_EXISTS", message="Unit code already exists for this resource.", status_code=status.HTTP_409_CONFLICT)

    new_unit = ResourceUnit(
        resource_id=res.id,
        unit_code=req.unit_code.strip(),
        condition=req.condition,
        is_active=True,
    )
    db.add(new_unit)
    res.quantity += 1
    db.commit()
    db.refresh(new_unit)
    return new_unit

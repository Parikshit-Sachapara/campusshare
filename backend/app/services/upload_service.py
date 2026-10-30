import os
import uuid
import shutil
from typing import List
from fastapi import UploadFile, status
from sqlalchemy.orm import Session
from ..config import settings
from ..models import ResourceImage, Resource
from ..core.exceptions import CampusShareException

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 # 5 MB

class UploadService:
    @staticmethod
    async def upload_resource_images(db: Session, resource_id: uuid.UUID, files: List[UploadFile]) -> List[ResourceImage]:
        res = db.query(Resource).filter_by(id=resource_id).first()
        if not res:
            raise CampusShareException(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=status.HTTP_404_NOT_FOUND)

        upload_dir = settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)

        created_images: List[ResourceImage] = []

        existing_count = db.query(ResourceImage).filter_by(resource_id=resource_id).count()

        for idx, file in enumerate(files):
            # Check content type and extension
            ext = os.path.splitext(file.filename or "")[1].lower()
            if ext not in ALLOWED_EXTENSIONS or file.content_type not in ALLOWED_MIME_TYPES:
                raise CampusShareException(
                    code="INVALID_FILE_TYPE",
                    message=f"Invalid file type for {file.filename}. Allowed: JPG, PNG, WEBP.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            # Check size by reading chunks
            content = await file.read()
            if len(content) > MAX_FILE_SIZE_BYTES:
                raise CampusShareException(
                    code="FILE_TOO_LARGE",
                    message=f"File {file.filename} exceeds maximum allowed size of 5 MB.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            # Generate unique filename
            unique_filename = f"res_{resource_id}_{uuid.uuid4().hex[:8]}{ext}"
            file_path = os.path.join(upload_dir, unique_filename)

            with open(file_path, "wb") as f:
                f.write(content)

            url = f"/uploads/{unique_filename}"
            is_primary = (existing_count + idx) == 0

            img_entry = ResourceImage(
                resource_id=resource_id,
                url=url,
                is_primary=is_primary,
                sort_order=existing_count + idx + 1,
            )
            db.add(img_entry)
            created_images.append(img_entry)

        db.commit()
        return created_images

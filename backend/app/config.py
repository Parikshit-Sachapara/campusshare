from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://neondb_owner:npg_T6NGiqOyvlg5@ep-delicate-resonance-b5vghdem.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
    JWT_SECRET: str = "supersecret-campusshare-jwt-key-32bytes-min"
    JWT_ALGORITHM: str = "HS256"
    SECRET_KEY: str = "supersecret-campusshare-jwt-key-32bytes-min"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    STORAGE_MODE: str = "local"
    UPLOAD_DIR: str = "./uploads"
    CORS_ORIGINS: str = ""
    REFRESH_SECRET: str = "supersecret-campusshare-refresh-key-32bytes-min"
    QR_SECRET: str = "supersecret-campusshare-qr-verification-token-key"
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    LLM_API_KEY: Optional[str] = None

    def model_post_init(self, __context):
        if self.JWT_SECRET and self.SECRET_KEY == "supersecret-campusshare-jwt-key-32bytes-min":
            self.SECRET_KEY = self.JWT_SECRET
        if self.JWT_ALGORITHM and self.ALGORITHM == "HS256":
            self.ALGORITHM = self.JWT_ALGORITHM

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
